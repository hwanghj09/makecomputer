# 7단계 — Zero Flag, Monitor Mode, HALT, KEY_READY, Boot ROM

> 이 파일에서는 칩 번호 별칭을 쓰지 않는다. 항상 **부품명 + 역할 + 실제 핀 번호**로 설명한다.

이번 파일에서는 74HC74 두 개와 Boot ROM 회로를 만든다.

---

# 7-1. Flag와 Mode가 뭔가

CPU는 계산 결과나 현재 상태를 1비트로 기억해야 할 때가 있다.

이 컴퓨터에서는 다음 상태를 기억한다.

- Z = 계산 결과가 0인지
- MONITOR_MODE = Boot ROM에서 실행 중인지
- KEY_READY = 키보드 글자 하나가 준비됐는지
- HALT = CPU가 멈춘 상태인지

74HC74 한 개에는 D Flip-Flop 두 개가 들어 있다.

---

# 7-2. 74HC74 Z Flag·MONITOR_MODE 저장칩

## 앞쪽 Flip-Flop = Z Flag

1. 1번 `/CLR` ← RESET_N
2. 2번 D ← Zero Detector의 ZERO 출력
3. 3번 CLK ← Z_CLK
4. 4번 `/PRE` → +5V
5. 5번 Q = Z
6. 6번 `/Q` = Z_N
7. 7번 → GND

## 뒤쪽 Flip-Flop = MONITOR_MODE

8. 8번 `/Q` = MONITOR_N
9. 9번 Q = MONITOR_MODE
10. 10번 `/PRE` ← RESET_N
11. 11번 CLK → GND
12. 12번 D → GND
13. 13번 `/CLR` ← RUN_T5_N
14. 14번 → +5V

### Z Flag 테스트

1. ZERO=HIGH 상태를 만든다.
2. Z_CLK를 한 번 준다.
3. 5번 Z가 HIGH인지 확인한다.
4. ZERO=LOW 상태에서 Z_CLK를 다시 주면 Z가 LOW가 되는지 확인한다.

### MONITOR_MODE 테스트

1. Reset을 걸면 MONITOR_MODE가 HIGH가 되는지 확인한다.
2. RUN 명령의 마지막 단계 조건을 만들어 13번 `/CLR`를 LOW로 만들면 MONITOR_MODE가 LOW가 되는지 확인한다.

> 74HC74의 `/PRE`와 `/CLR`는 둘 다 Active-Low다. 같은 Flip-Flop에서 둘을 동시에 LOW로 만들지 않는다.

---

# 7-3. 74HC74 KEY_READY·HALT 저장칩

## 앞쪽 Flip-Flop = KEY_READY

1. 1번 `/CLR` ← KEY_CLR_N
2. 2번 D → +5V
3. 3번 CLK ← FRAME_CLK
4. 4번 `/PRE` → +5V
5. 5번 Q = KEY_READY
6. 6번 `/Q` = KEY_READY_N
7. 7번 → GND

## 뒤쪽 Flip-Flop = HALT

8. 8번 `/Q` = RUN_EN
9. 9번 Q = HALT
10. 10번 `/PRE` ← HLT_T5_N
11. 11번 CLK → GND
12. 12번 D → GND
13. 13번 `/CLR` ← RESET_N
14. 14번 → +5V

### HALT 테스트

1. Reset 직후 RUN_EN이 HIGH인지 확인한다.
2. HLT_T5_N을 LOW로 만들면 HALT가 저장되고 RUN_EN이 LOW가 되는지 확인한다.
3. Reset하면 다시 RUN_EN이 HIGH가 되는지 확인한다.

KEY_READY는 PS/2 키보드 단계에서 최종 테스트한다.

---

# 7-4. Boot ROM이 왜 필요한가

RAM은 전원을 끄면 내용이 사라진다.

그래서 전원을 켰을 때 바로 실행할 Monitor 프로그램은 EEPROM에 저장한다.

이 EEPROM이 Boot ROM이다.

Reset 직후:

```text
MONITOR_MODE = 1
PC = 0
↓
Boot ROM 주소 0부터 명령어 실행
```

사용자가 `RUN 주소`를 실행하면 MONITOR_MODE가 0이 되고 이후에는 RAM의 사용자 프로그램을 실행한다.

---

# 7-5. AT28C64B Monitor Boot ROM 연결

V1에서는 주소 A0~A7만 사용하고 상위 주소는 GND에 고정한다.

1. 1번 NC → 연결하지 않음
2. 2번 A12 → GND
3. 3번 A7 ← 74HC161 PC 상위 4비트 카운터 11번 QD(PC7)
4. 4번 A6 ← PC 상위 카운터 12번 QC
5. 5번 A5 ← PC 상위 카운터 13번 QB
6. 6번 A4 ← PC 상위 카운터 14번 QA
7. 7번 A3 ← 74HC161 PC 하위 4비트 카운터 11번 QD
8. 8번 A2 ← PC 하위 카운터 12번 QC
9. 9번 A1 ← PC 하위 카운터 13번 QB
10. 10번 A0 ← PC 하위 카운터 14번 QA
11. 11번 I/O0 → Boot ROM 버스 드라이버 2번
12. 12번 I/O1 → Boot ROM 버스 드라이버 3번
13. 13번 I/O2 → Boot ROM 버스 드라이버 4번
14. 14번 → GND
15. 15번 I/O3 → Boot ROM 버스 드라이버 5번
16. 16번 I/O4 → Boot ROM 버스 드라이버 6번
17. 17번 I/O5 → Boot ROM 버스 드라이버 7번
18. 18번 I/O6 → Boot ROM 버스 드라이버 8번
19. 19번 I/O7 → Boot ROM 버스 드라이버 9번
20. 20번 `/CE` → GND
21. 21번 A10 → GND
22. 22번 `/OE` → GND
23. 23번 A11 → GND
24. 24번 A9 → GND
25. 25번 A8 → GND
26. 26번 NC → 연결하지 않음
27. 27번 `/WE` → +5V
28. 28번 → +5V

28번과 14번 가까이에 0.1µF 커패시터를 단다.

---

# 7-6. 74HC245 Boot ROM 데이터 버스 드라이버

이 칩은 Boot ROM 데이터를 CPU DATA BUS로 내보낼 때만 켜진다.

1. 1번 DIR → +5V
2. 2번 A1 ← Boot ROM 11번 I/O0
3. 3번 A2 ← Boot ROM 12번 I/O1
4. 4번 A3 ← Boot ROM 13번 I/O2
5. 5번 A4 ← Boot ROM 15번 I/O3
6. 6번 A5 ← Boot ROM 16번 I/O4
7. 7번 A6 ← Boot ROM 17번 I/O5
8. 8번 A7 ← Boot ROM 18번 I/O6
9. 9번 A8 ← Boot ROM 19번 I/O7
10. 10번 → GND
11. 11번 B8 → DB7
12. 12번 B7 → DB6
13. 13번 B6 → DB5
14. 14번 B5 → DB4
15. 15번 B4 → DB3
16. 16번 B3 → DB2
17. 17번 B2 → DB1
18. 18번 B1 → DB0
19. 19번 `/OE` ← Boot/Keyboard/LCD BUS 제어 OR 칩의 Boot ROM Enable 출력
20. 20번 → +5V

---

# 7-7. Boot ROM 단독 테스트

EEPROM Programmer로 눈에 잘 띄는 값 몇 개를 먼저 기록한다.

예:

```text
주소 0 = AA
주소 1 = 55
주소 2 = F0
```

그 다음:

1. Program Counter=0 → Boot ROM 출력 AA인지 확인
2. Program Counter=1 → 55인지 확인
3. Program Counter=2 → F0인지 확인
4. Boot ROM 버스 드라이버 `/OE`=LOW → DATA BUS에 같은 값이 보이는지 확인
5. `/OE`=HIGH → DATA BUS에서 빠지는지 확인

---

# 완료 체크

- [ ] Z Flag 저장 정상
- [ ] Reset 후 MONITOR_MODE=1
- [ ] RUN 조건 후 MONITOR_MODE=0
- [ ] HLT 후 RUN_EN=0
- [ ] Reset 후 다시 RUN_EN=1
- [ ] Boot ROM 주소 A0~A7와 PC 연결 정상
- [ ] Boot ROM 테스트 데이터 읽기 정상
- [ ] Boot ROM 버스 드라이버 ON/OFF 정상

[08_IO_LCD.md](./08_IO_LCD.md)
