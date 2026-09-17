# 6단계 — 자동 제어 논리 만들기

> 이 파일에서는 칩 번호 별칭을 쓰지 않는다. 같은 74HC08/74HC32/74HC04라도 **역할 이름**으로 구분한다.

이 단계가 가장 복잡하다. 한꺼번에 만들지 않는다.

```text
74HC08 AND 칩 1개 연결
↓
그 칩의 각 게이트 테스트
↓
다음 AND 칩
↓
74HC32 OR 칩
↓
74HC04 NOT 칩
↓
전체 연결
```

---

# 6-1. 먼저 알아야 하는 것

## AND

74HC08은 입력 두 개가 모두 HIGH일 때만 출력이 HIGH다.

```text
0 AND 0 = 0
0 AND 1 = 0
1 AND 0 = 0
1 AND 1 = 1
```

## OR

74HC32는 둘 중 하나라도 HIGH면 출력이 HIGH다.

## NOT

74HC04는 입력을 뒤집는다.

```text
0 → 1
1 → 0
```

## `_N` 이름

`LDA_N`, `T5_N`, `PC_LOAD_N`처럼 끝에 `_N`이 붙은 신호는 보통 **LOW가 활성**이다.

예:

```text
LDA_N = LOW  → 현재 명령이 LDA
HLT_N = LOW  → 현재 명령이 HLT
```

---

# 6-2. 74HC08 / 74HC32 공통 핀 구조

두 칩 모두 14핀이고 게이트 4개가 들어 있다.

```text
1,2 → 3
4,5 → 6
9,10 → 8
12,13 → 11
7 = GND
14 = +5V
```

74HC04는:

```text
1 → 2
3 → 4
5 → 6
9 → 8
11 → 10
13 → 12
7 = GND
14 = +5V
```

각 칩을 꽂을 때 7번 GND, 14번 +5V, 0.1µF 커패시터부터 연결한다.

---

# 6-3. 74HC08 CPU 클럭·2바이트 판정 AND 칩

역할: 원래 NE555 Clock을 CPU에 전달할지 결정하고, 명령어가 2바이트인지 판정한다.

1. 1번 ← NE555 클럭 발생기 3번 핀 RAW_CLK
2. 2번 ← RUN_EN 상태신호
3. 3번 → CPU_CLK
4. 4번 ← NOP_N
5. 5번 ← OUT_N
6. 6번 → BYTE2_A
7. 7번 → GND
8. 8번 → BYTE2
9. 9번 ← 6번 BYTE2_A
10. 10번 ← HLT_N
11. 11번 → T3_BYTE2
12. 12번 ← T3
13. 13번 ← 8번 BYTE2
14. 14번 → +5V

### 가장 먼저 테스트
1번과 2번을 수동 HIGH/LOW로 바꿔 3번이 AND 진리표대로 나오는지 확인한다.

---

# 6-4. 74HC08 MAR·A실행 제어 AND 칩

1. 1번 ← T3_BYTE2
2. 2번 ← LDI_N
3. 3번 → MAR_EN
4. 4번 ← CPU_CLK
5. 5번 ← 3번 MAR_EN
6. 6번 → 74HC273 메모리 주소 레지스터(MAR) 11번 Clock
7. 7번 → GND
8. 8번 → AEXEC_TMP
9. 9번 ← LDA_N
10. 10번 ← ADD_N
11. 11번 → A_EXEC_N
12. 12번 ← 8번 AEXEC_TMP
13. 13번 ← SUB_N
14. 14번 → +5V

---

# 6-5. 74HC08 A·IR 클럭 제어 AND 칩

1. 1번 ← LDI_T3_N
2. 2번 ← T5_AEXEC_N
3. 3번 → A_EN_N
4. 4번 ← CPU_CLK
5. 5번 ← A_EN
6. 6번 → 74HC273 A 레지스터 11번 Clock
7. 7번 → GND
8. 8번 → 74HC273 명령어 레지스터 11번 Clock
9. 9번 ← CPU_CLK
10. 10번 ← T1
11. 11번 → ADD_SUB_N
12. 12번 ← ADD_N
13. 13번 ← SUB_N
14. 14번 → +5V

### 테스트
CPU_CLK와 T1이 둘 다 HIGH일 때만 8번 IR Clock이 HIGH인지 확인한다.

---

# 6-6. 74HC08 SUB·CMP·Z·점프 제어 AND 칩

1. 1번 ← SUB_N
2. 2번 ← CMP_N
3. 3번 → SUBCMP_N
4. 4번 ← ADD_SUB_N
5. 5번 ← CMP_N
6. 6번 → ARITH_N
7. 7번 → GND
8. 8번 → Z_CLK
9. 9번 ← CPU_CLK
10. 10번 ← Z_EN
11. 11번 → JUMP_PAIR1_N
12. 12번 ← JMP_N
13. 13번 ← RUN_N
14. 14번 → +5V

---

# 6-7. 74HC08 점프·주소·읽기 제어 AND 칩

1. 1번 ← JZ_TAKE_N
2. 2번 ← JNZ_TAKE_N
3. 3번 → JUMP_PAIR2_N
4. 4번 ← JUMP_PAIR1_N
5. 5번 ← JUMP_PAIR2_N
6. 6번 → JUMP_ANY_N
7. 7번 → GND
8. 8번 → ADDR_LOW
9. 9번 ← T4_N
10. 10번 ← T5_N
11. 11번 → READOP_N
12. 12번 ← A_EXEC_N
13. 13번 ← CMP_N
14. 14번 → +5V

---

# 6-8. 74HC08 RAM 읽기 제어 AND 칩

1. 1번 ← PROG_READ_N
2. 2번 ← DATA_READ_N
3. 3번 → CDP1824CE RAM #1~#5의 16번 MRD
4. 4번 ← PROG_READ_N
5. 5번 ← LDA_T5_N
6. 6번 → RAM_BUS_READ_N
7. 7번 → GND
8. 8번 → ACCESS_N
9. 9번 ← 6번 RAM_BUS_READ_N
10. 10번 ← STA_T5_N
11. 11번 → RAMVALID_TMP
12. 12번 ← 74HC138 RAM 뱅크 디코더 10번 Y5
13. 13번 ← RAM 뱅크 디코더 9번 Y6
14. 14번 → +5V

---

# 6-9. 74HC08 RAM 버스·A/OUT/ALU 제어 AND 칩

1. 1번 ← RAMVALID_TMP
2. 2번 ← 74HC138 RAM 뱅크 디코더 7번 Y7
3. 3번 → RAM_VALID
4. 4번 ← ACCESS_POS
5. 5번 ← RAM_VALID
6. 6번 → U18_EN_POS라는 내부 제어신호
7. 7번 → GND
8. 8번 → AOUT_TMP1
9. 9번 ← STA_N
10. 10번 ← OUT_N
11. 11번 → AOUTALU_N
12. 12번 ← 8번 AOUT_TMP1
13. 13번 ← ADD_SUB_N
14. 14번 → +5V

> `U18_EN_POS`는 이름에 번호가 들어간 예전 설계명 대신 **RAM 버스 드라이버 Enable 양논리 신호**라고 이해하면 된다. 배선할 때는 이 문서의 6번 출력과 뒤의 RAM BUS 인버터 13번 입력을 연결한다.

---

# 6-10. 74HC08 키보드·LCD·ACK 제어 AND 칩

1. 1번 ← I/O 주소 디코더의 KEY_STATUS 선택 출력
2. 2번 ← I/O 주소 디코더의 KEY_DATA 선택 출력
3. 3번 → KEYSEL_N
4. 4번 ← A_CLK
5. 5번 ← KEY_ACK_COND
6. 6번 → KEY_ACK_PULSE
7. 7번 → GND
8. 8번 → KEY_CLR_N
9. 9번 ← RESET_N
10. 10번 ← KEY_ACK_PULSE_N
11. 11번 → LCDSEL_N
12. 12번 ← I/O 주소 디코더 LCD_DATA 출력
13. 13번 ← I/O 주소 디코더 LCD_COMMAND 출력
14. 14번 → +5V

---

# 6-11. 74HC08 OUT·LCD·PS2 제어 AND 칩

1. 1번 ← OUT_T5_N
2. 2번 ← LCD_WRITE_N
3. 3번 → OUT_EN_N
4. 4번 ← CPU_CLK
5. 5번 ← OUT_EN
6. 6번 → 74HC273 출력 레지스터 11번 Clock
7. 7번 → GND
8. 8번 → LCD E 핀
9. 9번 ← CPU_CLK
10. 10번 ← LCD_WRITE
11. 11번 → HIGHPAIR
12. 12번 ← 74HC161 PS/2 비트 카운터 11번 QD
13. 13번 ← QC_N
14. 14번 → +5V

---

# 6-12. 74HC08 PS2·RAM 쓰기 펄스 제어 AND 칩

1. 1번 ← LOWPAIR
2. 2번 ← HIGHPAIR
3. 3번 → COUNT11
4. 4번 ← PS2_INV_CLK
5. 5번 ← KEY_READY_N
6. 6번 → PS2_SAMPLE_CLK
7. 7번 → GND
8. 8번 → FRAME_CLK
9. 9번 ← PS2_POST_CLK
10. 10번 ← COUNT11
11. 11번 → RAM_WRITE_PULSE
12. 12번 ← CPU_CLK
13. 13번 ← STA_T5
14. 14번 → +5V

---

# 6-13. 74HC08 예비 AND 칩

현재 사용하지 않는다.

- 입력핀 1,2,4,5,9,10,12,13 → GND
- 7번 → GND
- 14번 → +5V
- 출력 3,6,8,11번 → 연결하지 않음

---

# 6-14. 74HC32 확장명령·PC카운트·LDI 제어 OR 칩

1. 1번 ← EXT_VALID_N
2. 2번 ← IR2
3. 3번 → EXT_LO_EN_N
4. 4번 ← EXT_VALID_N
5. 5번 ← IR2_N
6. 6번 → EXT_HI_EN_N
7. 7번 → GND
8. 8번 → PC_COUNT
9. 9번 ← T1
10. 10번 ← T3_BYTE2
11. 11번 → LDI_T3_N
12. 12번 ← T3_N
13. 13번 ← LDI_N
14. 14번 → +5V

PC_COUNT 출력은 최종적으로 74HC161 PC 하위 4비트 카운터 10번 ENT로 간다.

---

# 6-15. 74HC32 A·Z·조건점프 제어 OR 칩

1. 1번 ← T5_N
2. 2번 ← A_EXEC_N
3. 3번 → T5_AEXEC_N
4. 4번 ← T5_N
5. 5번 ← ARITH_N
6. 6번 → Z_EN_N
7. 7번 → GND
8. 8번 → JZ_TAKE_N
9. 9번 ← JZ_N
10. 10번 ← Z_N
11. 11번 → JNZ_TAKE_N
12. 12번 ← JNZ_N
13. 13번 ← Z
14. 14번 → +5V

---

# 6-16. 74HC32 PC LOAD·RUN·HLT·Program Read 제어 OR 칩

1. 1번 ← T5_N
2. 2번 ← JUMP_ANY_N
3. 3번 → 74HC161 PC 하위·상위 카운터의 9번 `/LOAD`
4. 4번 ← T5_N
5. 5번 ← RUN_N
6. 6번 → RUN_T5_N
7. 7번 → GND
8. 8번 → HLT_T5_N
9. 9번 ← T5_N
10. 10번 ← HLT_N
11. 11번 → PROG_READ_N
12. 12번 ← MONITOR_MODE
13. 13번 ← PC_COUNT_N
14. 14번 → +5V

---

# 6-17. 74HC32 Read·Write·BUS 제어 OR 칩

1. 1번 ← T5_N
2. 2번 ← READOP_N
3. 3번 → DATA_READ_N
4. 4번 ← STA_N
5. 5번 ← T5_N
6. 6번 → STA_T5_N
7. 7번 → GND
8. 8번 → LDA_T5_N
9. 9번 ← LDA_N
10. 10번 ← T5_N
11. 11번 → 74HC245 A/ALU 데이터 버스 드라이버 19번 `/OE`
12. 12번 ← T5_N
13. 13번 ← AOUTALU_N
14. 14번 → +5V

---

# 6-18. 74HC32 Boot·Keyboard·LCD BUS 제어 OR 칩

1. 1번 ← MONITOR_N
2. 2번 ← PC_COUNT_N
3. 3번 → 74HC245 Boot ROM 데이터 버스 드라이버 19번 `/OE`
4. 4번 ← LDA_T5_N
5. 5번 ← KEYSEL_N
6. 6번 → 74HC245 키보드 데이터 버스 드라이버 19번 `/OE`
7. 7번 → GND
8. 8번 → KEY_ACK_COND_N
9. 9번 ← LDA_T5_N
10. 10번 ← KEY_DATA 주소 선택 출력
11. 11번 → LCD_WRITE_N
12. 12번 ← STA_T5_N
13. 13번 ← LCDSEL_N
14. 14번 → +5V

---

# 6-19. 74HC32 OUT·Zero Tree 앞단 OR 칩

이 칩부터는 ALU 결과가 0인지 검사하는 Zero Detector도 같이 만든다.

1. 1번 ← OUT_N
2. 2번 ← T5_N
3. 3번 → OUT_T5_N
4. 4번 ← ALU0
5. 5번 ← ALU1
6. 6번 → ZERO01
7. 7번 → GND
8. 8번 → ZERO23
9. 9번 ← ALU2
10. 10번 ← ALU3
11. 11번 → ZERO45
12. 12번 ← ALU4
13. 13번 ← ALU5
14. 14번 → +5V

---

# 6-20. 74HC32 Zero Tree 뒷단 OR 칩

1. 1번 ← ALU6
2. 2번 ← ALU7
3. 3번 → ZERO67
4. 4번 ← ZERO01
5. 5번 ← ZERO23
6. 6번 → ZERO03
7. 7번 → GND
8. 8번 → ZERO47
9. 9번 ← ZERO45
10. 10번 ← ZERO67
11. 11번 → ZERO_ANY
12. 12번 ← ZERO03
13. 13번 ← ZERO47
14. 14번 → +5V

ZERO_ANY가 LOW일 때만 8비트 ALU 결과가 전부 0이다. 다음 인버터에서 이를 ZERO=HIGH로 바꾼다.

---

# 6-21. 74HC04 IR·T-state·A Enable 인버터

1. 1번 ← IR7
2. 2번 → IR7_N
3. 3번 ← IR2
4. 4번 → IR2_N
5. 5번 ← T1_N
6. 6번 → T1
7. 7번 → GND
8. 8번 → T3
9. 9번 ← T3_N
10. 10번 → ACCESS_POS
11. 11번 ← ACCESS_N
12. 12번 → A_EN
13. 13번 ← A_EN_N
14. 14번 → +5V

---

# 6-22. 74HC04 ALU·SUB·Z·Address·LCD 인버터

1. 1번 ← ADD_SUB_N
2. 2번 → ALU_SEL
3. 3번 ← SUBCMP_N
4. 4번 → SUB_MODE
5. 5번 ← Z_EN_N
6. 6번 → Z_EN
7. 7번 → GND
8. 8번 → ADDR_SEL
9. 9번 ← ADDR_LOW
10. 10번 → PC_COUNT_N
11. 11번 ← PC_COUNT
12. 12번 → LCD_WRITE
13. 13번 ← LCD_WRITE_N
14. 14번 → +5V

ALU_SEL은 74HC157 A/ALU 선택 MUX 두 칩의 1번 Select로 간다.
SUB_MODE는 74HC86 두 칩의 XOR 제어와 74HC283 ALU 하위 가산기 7번 CIN으로 간다.
ADDR_SEL은 74HC157 주소 선택 MUX 두 칩의 1번 Select로 간다.

---

# 6-23. 74HC04 OUT·ZERO·I/O·PS2·RAM BUS 인버터

1. 1번 ← OUT_EN_N
2. 2번 → OUT_EN
3. 3번 ← ZERO_ANY
4. 4번 → ZERO
5. 5번 ← ADDRESS A3
6. 6번 → A3_N
7. 7번 → GND
8. 8번 → QC_N
9. 9번 ← 74HC161 PS/2 비트 카운터 12번 QC
10. 10번 → LOWPAIR
11. 11번 ← LOWPAIR_N
12. 12번 → 74HC245 RAM 데이터 버스 드라이버 19번 `/OE`
13. 13번 ← RAM 버스 드라이버 Enable 양논리 신호
14. 14번 → +5V

---

# 6-24. 74HC04 STA·RAM Write·KEY ACK 인버터

1. 1번 ← STA_T5_N
2. 2번 → STA_T5
3. 3번 ← RAM_WRITE_PULSE
4. 4번 → CDP1824CE RAM #1~#5의 17번 MWR
5. 5번 ← KEY_ACK_COND_N
6. 6번 → KEY_ACK_COND
7. 7번 → GND
8. 8번 → KEY_ACK_PULSE_N
9. 9번 ← KEY_ACK_PULSE
10. 10번 → 미사용 출력
11. 11번 입력 → GND
12. 12번 → 미사용 출력
13. 13번 입력 → GND
14. 14번 → +5V

---

# 6-25. 제어회로 테스트 방법

이 단계에서는 프로그램 전체를 바로 실행하지 않는다.

각 게이트를 하나씩 확인한다.

## AND 게이트
입력 00,01,10,11 네 경우를 넣고 출력이 0001인지 확인한다.

## OR 게이트
입력 00,01,10,11에서 출력이 0111인지 확인한다.

## NOT 게이트
입력 LOW→출력 HIGH, 입력 HIGH→출력 LOW인지 확인한다.

## 그 다음 실제 신호 확인

1. 마이크로스텝을 T1로 만들면 IR Clock 조건이 생기는지 확인
2. LDA + T5에서 A Clock 조건이 생기는지 확인
3. ADD/SUB에서 ALU Select가 계산 결과 쪽으로 가는지 확인
4. STA + T5에서 RAM Write pulse가 생기는지 확인
5. HLT에서 RUN_EN이 꺼질 조건이 만들어지는지 확인

---

# 완료 체크

- [ ] 모든 74HC08 게이트 개별 테스트 정상
- [ ] 모든 74HC32 게이트 개별 테스트 정상
- [ ] 모든 74HC04 인버터 정상
- [ ] A Clock 정상
- [ ] IR Clock 정상
- [ ] MAR Clock 정상
- [ ] Program Counter Count/Load 제어 정상
- [ ] RAM Read/Write 제어 정상
- [ ] Zero Detector 출력 정상

[07_Flag_BootROM.md](./07_Flag_BootROM.md)
