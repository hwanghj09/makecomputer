# 9단계 — PS/2 키보드

> 이 파일에서는 칩 번호 별칭을 쓰지 않는다. 항상 **부품명 + 역할 + 실제 핀 번호**로 설명한다.

PS/2 부분은 아래 순서대로 만든다.

```text
Mini-DIN 6핀 소켓
↓
74HC14 Schmitt Trigger
↓
74HC161 PS/2 비트 카운터
↓
74HC164 시프트 레지스터 앞단
↓
74HC164 시프트 레지스터 뒷단
↓
AT28C64B Scan Code→ASCII ROM
↓
74HC157 STATUS/DATA MUX 두 개
↓
74HC245 키보드 데이터 버스 드라이버
↓
실제 키보드 테스트
```

---

# 9-1. PS/2가 보내는 데이터

키 하나를 누르면 PS/2 키보드는 직렬로 11비트를 보낸다.

```text
Start
D0
D1
D2
D3
D4
D5
D6
D7
Parity
Stop
```

이 컴퓨터는 가운데 D0~D7을 모아서 Scan Code를 만들고 EEPROM으로 ASCII로 변환한다.

---

# 9-2. PS/2 Mini-DIN 6핀

전기적 핀 번호:

1. DATA → +5V에 4.7kΩ Pull-up → 🟩 초록
2. NC
3. GND → ⬛ 검정
4. +5V → 🟥 빨강
5. CLOCK → +5V에 4.7kΩ Pull-up → 🟦 파랑
6. NC

> Mini-DIN 소켓은 앞에서 볼 때와 납땜면에서 볼 때 좌우가 뒤집혀 보일 수 있다. 실제 구매한 소켓의 핀 번호를 반드시 확인한다.

---

# 9-3. 74HC14 PS/2 Schmitt Trigger

PS/2 Clock/Data 선의 지저분한 전압 변화를 깨끗한 디지털 HIGH/LOW로 정리한다.

1. 1번 1A ← PS/2 CLOCK raw
2. 2번 1Y → PS2_INV_CLK
3. 3번 2A ← 2번 출력
4. 4번 2Y → PS2_POST_CLK
5. 5번 3A ← PS/2 DATA raw
6. 6번 3Y → 9번 입력
7. 7번 → GND
8. 8번 4Y = PS2_DATA_CLEAN
9. 9번 4A ← 6번 출력
10. 10번 5Y → 사용하지 않음
11. 11번 5A → GND
12. 12번 6Y → 사용하지 않음
13. 13번 6A → GND
14. 14번 → +5V

## 테스트

CLOCK와 DATA 입력을 천천히 HIGH/LOW로 바꾸고 각 출력이 깨끗하게 반전되는지 확인한다.

---

# 9-4. 74HC161 PS/2 비트 카운터

현재 PS/2 프레임에서 몇 번째 비트를 받고 있는지 센다.

1. 1번 `/CLR` ← KEY_CLR_N
2. 2번 CLK ← PS2_SAMPLE_CLK
3. 3번 A → GND
4. 4번 B → GND
5. 5번 C → GND
6. 6번 D → GND
7. 7번 ENP → +5V
8. 8번 → GND
9. 9번 `/LOAD` → +5V
10. 10번 ENT → +5V
11. 11번 QD → HIGHPAIR 검출 회로
12. 12번 QC → QC_N 인버터
13. 13번 QB → 확장명령 유효·PS2 카운트 디코더 13번 입력
14. 14번 QA → 같은 디코더 14번 입력
15. 15번 RCO → 사용하지 않음
16. 16번 → +5V

## 테스트

수동 Clock를 한 번씩 넣어 QA/QB/QC/QD가 이진수로 증가하는지 본다.

`/CLR`를 잠깐 LOW로 내리면 0000으로 돌아가야 한다.

---

# 9-5. 74HC139 확장명령 유효·PS2 카운트 디코더의 뒤쪽 절반

이 칩의 앞쪽 절반은 확장 명령 판정에 이미 사용했다. 뒤쪽 절반은 PS/2 비트 카운터의 QA/QB 상태를 본다.

9번 `/2Y3` = LOWPAIR_N
10~12번 출력 → 사용하지 않음
13번 2B ← PS/2 비트 카운터 13번 QB
14번 2A ← PS/2 비트 카운터 14번 QA
15번 `/2G` → GND

---

# 9-6. 74HC164 PS/2 시프트 레지스터 앞단

직렬 DATA를 Clock마다 한 칸씩 밀어서 병렬 데이터로 바꾼다.

1. 1번 A ← 74HC14 PS/2 Schmitt Trigger 8번 PS2_DATA_CLEAN
2. 2번 B → +5V
3. 3번 QA = Stop bit 위치, 사용하지 않음
4. 4번 QB = Parity 위치, 사용하지 않음
5. 5번 QC = Scan bit7 → ASCII ROM A7
6. 6번 QD = Scan bit6 → ASCII ROM A6
7. 7번 → GND
8. 8번 CLK ← PS2_SAMPLE_CLK
9. 9번 `/CLR` ← RESET_N
10. 10번 QE = Scan bit5 → ASCII ROM A5
11. 11번 QF = Scan bit4 → ASCII ROM A4
12. 12번 QG = Scan bit3 → ASCII ROM A3
13. 13번 QH = Scan bit2 → 뒤쪽 시프트 레지스터 1번 A + ASCII ROM A2
14. 14번 → +5V

# 9-7. 74HC164 PS/2 시프트 레지스터 뒷단

1. 1번 A ← 앞쪽 시프트 레지스터 13번 QH
2. 2번 B → +5V
3. 3번 QA = Scan bit1 → ASCII ROM A1
4. 4번 QB = Scan bit0 → ASCII ROM A0
5. 5번 QC = Start bit 위치, 사용하지 않음
6. 6번 QD → 사용하지 않음
7. 7번 → GND
8. 8번 CLK ← PS2_SAMPLE_CLK
9. 9번 `/CLR` ← RESET_N
10~13번 → 사용하지 않음
14. 14번 → +5V

## 시프트 테스트

실제 키보드를 연결하기 전에 DATA에 1/0 패턴을 수동으로 넣고 Sample Clock을 한 번씩 준다. 비트가 한 칸씩 이동하는지 LED로 확인한다.

---

# 9-8. AT28C64B Scan Code→ASCII 변환 ROM

EEPROM의 주소에 PS/2 Scan Code를 넣고, 그 주소의 데이터에 ASCII를 미리 기록해 둔다.

예:

```text
A 키 Scan Code 주소 → 0x41
B 키 Scan Code 주소 → 0x42
```

## 연결

1. 1번 NC → 연결하지 않음
2. 2번 A12 → GND
3. 3번 A7 ← 앞쪽 시프트 레지스터 5번
4. 4번 A6 ← 앞쪽 시프트 레지스터 6번
5. 5번 A5 ← 앞쪽 시프트 레지스터 10번
6. 6번 A4 ← 앞쪽 시프트 레지스터 11번
7. 7번 A3 ← 앞쪽 시프트 레지스터 12번
8. 8번 A2 ← 앞쪽 시프트 레지스터 13번
9. 9번 A1 ← 뒤쪽 시프트 레지스터 3번
10. 10번 A0 ← 뒤쪽 시프트 레지스터 4번
11. 11번 I/O0 → 키보드 STATUS/DATA MUX 하위칩 3번
12. 12번 I/O1 → 하위 MUX 6번
13. 13번 I/O2 → 하위 MUX 10번
14. 14번 → GND
15. 15번 I/O3 → 하위 MUX 13번
16. 16번 I/O4 → 키보드 STATUS/DATA MUX 상위칩 3번
17. 17번 I/O5 → 상위 MUX 6번
18. 18번 I/O6 → 상위 MUX 10번
19. 19번 I/O7 → 상위 MUX 13번
20. 20번 `/CE` → GND
21. 21번 A10 → GND
22. 22번 `/OE` → GND
23. 23번 A11 → GND
24. 24번 A9 → GND
25. 25번 A8 → GND
26. 26번 NC → 연결하지 않음
27. 27번 `/WE` → +5V
28. 28번 → +5V

## 테스트

EEPROM Programmer로 A키 Scan Code 주소에 0x41을 기록한다. 그 Scan Code를 주소 A0~A7에 넣었을 때 I/O7~I/O0이 `01000001`인지 확인한다.

---

# 9-9. KEY_STATUS와 KEY_DATA를 고르는 74HC157 두 개

주소 160에서는 상태를, 주소 161에서는 ASCII 데이터를 내보내야 한다.

A0=0 → STATUS
A0=1 → DATA

## 74HC157 키보드 STATUS/DATA MUX 하위칩

1. 1번 S ← ADDRESS A0
2. 2번 1A ← KEY_READY
3. 3번 1B ← ASCII ROM 11번 I/O0
4. 4번 1Y → 키보드 버스 드라이버 2번
5. 5번 2A → GND
6. 6번 2B ← ASCII ROM 12번 I/O1
7. 7번 2Y → 버스 드라이버 3번
8. 8번 → GND
9. 9번 3Y → 버스 드라이버 4번
10. 10번 3B ← ASCII ROM 13번 I/O2
11. 11번 3A → GND
12. 12번 4Y → 버스 드라이버 5번
13. 13번 4B ← ASCII ROM 15번 I/O3
14. 14번 4A → GND
15. 15번 `/G` → GND
16. 16번 → +5V

## 74HC157 키보드 STATUS/DATA MUX 상위칩

1. 1번 S ← ADDRESS A0
2. 2번 1A → GND
3. 3번 1B ← ASCII ROM 16번 I/O4
4. 4번 1Y → 키보드 버스 드라이버 6번
5. 5번 2A → GND
6. 6번 2B ← ASCII ROM 17번 I/O5
7. 7번 2Y → 버스 드라이버 7번
8. 8번 → GND
9. 9번 3Y → 버스 드라이버 8번
10. 10번 3B ← ASCII ROM 18번 I/O6
11. 11번 3A → GND
12. 12번 4Y → 버스 드라이버 9번
13. 13번 4B ← ASCII ROM 19번 I/O7
14. 14번 4A → GND
15. 15번 `/G` → GND
16. 16번 → +5V

## MUX 테스트

- ADDRESS A0=0 → 출력 bit0만 KEY_READY이고 bit7~1은 0
- ADDRESS A0=1 → ASCII 8비트 출력

---

# 9-10. 74HC245 키보드 데이터 버스 드라이버

1. 1번 DIR → +5V
2. 2번 ← 하위 키보드 MUX 4번
3. 3번 ← 하위 MUX 7번
4. 4번 ← 하위 MUX 9번
5. 5번 ← 하위 MUX 12번
6. 6번 ← 상위 MUX 4번
7. 7번 ← 상위 MUX 7번
8. 8번 ← 상위 MUX 9번
9. 9번 ← 상위 MUX 12번
10. 10번 → GND
11. 11번 B8 → DB7
12. 12번 B7 → DB6
13. 13번 B6 → DB5
14. 14번 B5 → DB4
15. 15번 B4 → DB3
16. 16번 B3 → DB2
17. 17번 B2 → DB1
18. 18번 B1 → DB0
19. 19번 `/OE` ← Boot·Keyboard·LCD BUS 제어 OR 칩의 KEY_READ_N 출력
20. 20번 → +5V

---

# 9-11. NPN 트랜지스터 PS/2 Clock Hold

키 하나를 받은 뒤 CPU가 읽을 때까지 키보드가 다음 데이터를 보내지 못하게 Clock를 잠시 LOW로 잡는 용도다.

- Collector → PS/2 CLOCK
- Emitter → GND
- Base ← KEY_READY를 4.7kΩ~10kΩ 저항을 거쳐 연결

> 실제 E/B/C 다리 순서는 구매한 트랜지스터 모델 데이터시트를 확인한다.

---

# 9-12. 실제 키보드 최종 테스트

1. PS/2 키보드를 연결한다.
2. A키를 누른다.
3. 11비트가 시프트 레지스터로 들어오는지 확인한다.
4. PS/2 비트 카운터가 프레임 길이를 세는지 확인한다.
5. KEY_READY가 HIGH가 되는지 확인한다.
6. 주소 161 KEY_DATA를 읽었을 때 ASCII `0x41`이 DATA BUS에 나타나는지 확인한다.
7. CPU가 KEY_DATA를 읽은 뒤 KEY_READY가 다시 LOW가 되는지 확인한다.
8. 다음 키를 다시 받을 수 있는지 확인한다.

---

# 완료 체크

- [ ] PS/2 CLOCK/DATA Pull-up 정상
- [ ] 74HC14 출력 정상
- [ ] 비트 카운터 정상
- [ ] 시프트 레지스터 정상
- [ ] Scan Code→ASCII ROM 정상
- [ ] STATUS/DATA MUX 정상
- [ ] 키보드 버스 드라이버 정상
- [ ] A키 → ASCII 0x41 확인
- [ ] KEY_READY set/clear 정상

[10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md)
