# 6단계 — 자동 제어 논리

이 단계가 가장 복잡하다.
**절대로 모든 게이트를 한꺼번에 연결하지 않는다.**

한 칩을 연결하면 그 칩만 테스트하고, 정상일 때 다음 칩으로 넘어간다.

이 파일에서는 항상:

```text
부품 역할 + 핀 번호 + 신호 이름 + 연결 대상
```

순서로 적는다.

---

# 6-0. 먼저 알아둘 규칙

## HIGH / LOW

```text
HIGH = +5V
LOW  = GND
```

## `_N` 또는 `/`가 붙은 신호

대부분 **LOW일 때 활성**이라는 뜻이다.

예:

```text
LDA_N = LOW → 현재 LDA가 선택됨
/OE   = LOW → 출력 활성화
```

## 논리게이트

```text
AND : 두 입력이 모두 HIGH일 때만 HIGH
OR  : 둘 중 하나라도 HIGH면 HIGH
NOT : 입력을 반대로 출력
```

## 74HC08 / 74HC32 / 74HC04 공통 전원

이 단계에 사용하는 14핀 논리 IC는 모두:

```text
14번 VCC → +5V
7번 GND  → GND
```

로 연결하고, 각 칩의 14번과 7번 사이에 0.1µF 커패시터를 하나씩 둔다.

아래 각 항목에서는 반복을 줄이기 위해 7번/14번 전원 연결을 생략하지 않고 다시 표시한다.

---

# 6-1. 74HC08 — CPU Clock / 2바이트 명령 판정

## 역할

1. CPU가 RUN 상태일 때만 RAW_CLK를 CPU_CLK로 통과시킨다.
2. 명령이 두 번째 바이트를 필요로 하는지 판정한다.
3. T3와 2바이트 조건을 합쳐 `T3_BYTE2`를 만든다.

## 연결

```text
1번  ← NE555 3번 RAW_CLK
2번  ← RUN_EN
3번  CPU_CLK → PC 하위 74HC161 2번
             → PC 상위 74HC161 2번
             → 마이크로스텝 74HC161 2번

4번  ← NOP_N
5번  ← OUT_N
6번  BYTE2_A → 같은 칩 9번

7번  → GND

8번  BYTE2 → 같은 칩 13번
9번  ← 같은 칩 6번 BYTE2_A
10번 ← HLT_N
11번 T3_BYTE2 → MAR·A실행 AND 칩 1번
               → 확장명령·PC카운트·LDI OR 칩 10번
12번 ← T3
13번 ← 같은 칩 8번 BYTE2
14번 → +5V
```

## 처음 테스트할 때

아직 RUN_EN 저장회로를 연결하지 않았다면 2번을 임시로 +5V에 둔다.

```text
1번 RAW_CLK가 움직일 때
2번 HIGH → 3번 CPU_CLK도 움직여야 함
2번 LOW  → 3번 CPU_CLK가 멈춰야 함
```

---

# 6-2. 74HC08 — MAR / A 실행 제어

## 역할

- 필요한 순간에 MAR Clock을 만든다.
- LDA/ADD/SUB 계열 실행 조건을 만든다.

## 연결

```text
1번  ← T3_BYTE2
2번  ← LDI_N
3번  MAR_EN → 같은 칩 5번

4번  ← CPU_CLK
5번  ← 같은 칩 3번 MAR_EN
6번  MAR_CLK → 74HC273 MAR 11번 CLK

7번  → GND

8번  AEXEC_TMP → 같은 칩 12번
9번  ← LDA_N
10번 ← ADD_N
11번 A_EXEC_N → A·IR Clock AND 칩 2번
               → 점프·주소·읽기 AND 칩 12번
12번 ← 같은 칩 8번 AEXEC_TMP
13번 ← SUB_N
14번 → +5V
```

---

# 6-3. 74HC08 — A 레지스터 / IR Clock 제어

## 역할

A 레지스터와 IR에 필요한 Clock만 만들어 준다.

## 연결

```text
1번  ← LDI_T3_N
2번  ← T5_AEXEC_N
3번  A_EN_N → IR·T-state·A Enable 74HC04 13번

4번  ← CPU_CLK
5번  ← A_EN
6번  A_CLK → 74HC273 A 레지스터 11번
            → 키보드·LCD·ACK AND 칩 4번

7번  → GND

8번  IR_CLK → 74HC273 IR 11번
9번  ← CPU_CLK
10번 ← T1

11번 ADD_SUB_N → SUB·CMP·Z·점프 AND 칩 4번
                → RAM 버스·A/OUT/ALU AND 칩 13번
                → ALU·SUB·Z·Address·LCD 74HC04 1번
12번 ← ADD_N
13번 ← SUB_N
14번 → +5V
```

---

# 6-4. 74HC08 — SUB / CMP / Z / 점프 제어

## 연결

```text
1번  ← SUB_N
2번  ← CMP_N
3번  SUBCMP_N → ALU·SUB·Z·Address·LCD 74HC04 3번

4번  ← ADD_SUB_N
5번  ← CMP_N
6번  ARITH_N → A·Z·조건점프 OR 칩 5번

7번  → GND

8번  Z_CLK → 74HC74 Z Flag·MONITOR_MODE 3번 CLK
9번  ← CPU_CLK
10번 ← Z_EN

11번 JUMP_PAIR1_N → 점프·주소·읽기 AND 칩 4번
12번 ← JMP_N
13번 ← RUN_N
14번 → +5V
```

---

# 6-5. 74HC08 — 점프 / 주소 / 읽기 제어

## 연결

```text
1번  ← JZ_TAKE_N
2번  ← JNZ_TAKE_N
3번  JUMP_PAIR2_N → 같은 칩 5번

4번  ← JUMP_PAIR1_N
5번  ← 같은 칩 3번 JUMP_PAIR2_N
6번  JUMP_ANY_N → PC LOAD·RUN·HLT·Program Read OR 칩 2번

7번  → GND

8번  ADDR_LOW → ALU·SUB·Z·Address·LCD 74HC04 9번
9번  ← 마이크로스텝 74HC138 11번 T4_N
10번 ← 마이크로스텝 74HC138 10번 T5_N

11번 READOP_N → Read·Write·BUS OR 칩 2번
12번 ← A_EXEC_N
13번 ← CMP_N
14번 → +5V
```

---

# 6-6. 74HC08 — RAM 읽기 제어

## 역할

RAM의 16번 `MRD`와 RAM 버스가 언제 활성화될지 결정한다.

## 연결

```text
1번  ← PROG_READ_N
2번  ← DATA_READ_N
3번  RAM_MRD_N → RAM #1~#5의 16번 MRD

4번  ← PROG_READ_N
5번  ← LDA_T5_N
6번  RAM_BUS_READ_N → 같은 칩 9번

7번  → GND

8번  ACCESS_N → IR·T-state·A Enable 74HC04 11번
9번  ← 같은 칩 6번 RAM_BUS_READ_N
10번 ← STA_T5_N

11번 RAMVALID_TMP → RAM 버스·A/OUT/ALU AND 칩 1번
12번 ← RAM 뱅크 74HC138 10번 Y5
13번 ← RAM 뱅크 74HC138 9번 Y6
14번 → +5V
```

---

# 6-7. 74HC08 — RAM BUS / A-OUT-ALU 제어

## 연결

```text
1번  ← RAMVALID_TMP
2번  ← RAM 뱅크 74HC138 7번 Y7
3번  RAM_VALID → 같은 칩 5번

4번  ← ACCESS_POS
5번  ← 같은 칩 3번 RAM_VALID
6번  RAM_BUS_ENABLE_POS → OUT·ZERO·I/O·PS2·RAM BUS 74HC04 13번

7번  → GND

8번  AOUT_TMP1 → 같은 칩 12번
9번  ← STA_N
10번 ← OUT_N
11번 AOUTALU_N → Read·Write·BUS OR 칩 13번
12번 ← 같은 칩 8번 AOUT_TMP1
13번 ← ADD_SUB_N
14번 → +5V
```

---

# 6-8. 74HC08 — Keyboard / LCD / ACK 제어

## 연결

```text
1번  ← I/O 주소 74HC138 15번 KEY_STATUS_N
2번  ← I/O 주소 74HC138 14번 KEY_DATA_N
3번  KEYSEL_N → Boot·Keyboard·LCD BUS OR 칩 5번

4번  ← A_CLK
5번  ← KEY_ACK_COND
6번  KEY_ACK_PULSE → STA·RAM Write·KEY ACK 74HC04 9번

7번  → GND

8번  KEY_CLR_N → 74HC74 KEY_READY·HALT 1번 /CLR
                 → PS/2 비트 카운터 74HC161 1번 /CLR
9번  ← RESET_N
10번 ← KEY_ACK_PULSE_N

11번 LCDSEL_N → Boot·Keyboard·LCD BUS OR 칩 13번
12번 ← I/O 주소 74HC138 13번 LCD_DATA_N
13번 ← I/O 주소 74HC138 12번 LCD_COMMAND_N
14번 → +5V
```

---

# 6-9. 74HC08 — OUT / LCD / PS2 제어

## 연결

```text
1번  ← OUT_T5_N
2번  ← LCD_WRITE_N
3번  OUT_EN_N → OUT·ZERO·I/O·PS2·RAM BUS 74HC04 1번

4번  ← CPU_CLK
5번  ← OUT_EN
6번  OUT_CLK → 74HC273 OUT 레지스터 11번

7번  → GND

8번  LCD_E → LCD 6번 E
9번  ← CPU_CLK
10번 ← LCD_WRITE

11번 HIGHPAIR → PS2·RAM Write Pulse AND 칩 2번
12번 ← PS/2 비트 카운터 11번 QD
13번 ← QC_N
14번 → +5V
```

---

# 6-10. 74HC08 — PS/2 Sample / RAM Write Pulse

## 연결

```text
1번  ← LOWPAIR
2번  ← HIGHPAIR
3번  COUNT11 → 같은 칩 5번

4번  ← PS2_INV_CLK
5번  ← KEY_READY_N
6번  PS2_SAMPLE_CLK → PS/2 74HC164 앞단 8번
                      → PS/2 74HC164 뒷단 8번
                      → PS/2 비트 카운터 74HC161 2번

7번  → GND

8번  FRAME_CLK → 74HC74 KEY_READY·HALT 3번
9번  ← PS2_POST_CLK
10번 ← 같은 칩 3번 COUNT11

11번 RAM_WRITE_PULSE → STA·RAM Write·KEY ACK 74HC04 3번
12번 ← CPU_CLK
13번 ← STA_T5
14번 → +5V
```

---

# 6-11. 74HC08 — 예비 AND 칩

사용하지 않는 **입력은 떠 있게 두지 않는다.**

```text
1번  → GND
2번  → GND
4번  → GND
5번  → GND
9번  → GND
10번 → GND
12번 → GND
13번 → GND
7번  → GND
14번 → +5V
```

출력 `3, 6, 8, 11번`은 연결하지 않는다.

---

# 6-12. 74HC32 — 확장명령 / PC Count / LDI 제어

## 연결

```text
1번  ← EXT_VALID_N
2번  ← IR2
3번  EXT_LO_EN_N → 확장 명령 74HC139 1번 /1G

4번  ← EXT_VALID_N
5번  ← IR2_N
6번  EXT_HI_EN_N → 확장 명령 74HC139 15번 /2G

7번  → GND

8번  PC_COUNT → PC 하위 74HC161 10번 ENT
                → ALU·SUB·Z·Address·LCD 74HC04 11번
9번  ← T1
10번 ← T3_BYTE2

11번 LDI_T3_N → A·IR Clock AND 칩 1번
12번 ← T3_N
13번 ← LDI_N
14번 → +5V
```

---

# 6-13. 74HC32 — A / Z / 조건점프 제어

## 연결

```text
1번  ← T5_N
2번  ← A_EXEC_N
3번  T5_AEXEC_N → A·IR Clock AND 칩 2번

4번  ← T5_N
5번  ← ARITH_N
6번  Z_EN_N → ALU·SUB·Z·Address·LCD 74HC04 5번

7번  → GND

8번  JZ_TAKE_N → 점프·주소·읽기 AND 칩 1번
9번  ← JZ_N
10번 ← Z_N

11번 JNZ_TAKE_N → 점프·주소·읽기 AND 칩 2번
12번 ← JNZ_N
13번 ← Z
14번 → +5V
```

---

# 6-14. 74HC32 — PC LOAD / RUN / HLT / Program Read

## 연결

```text
1번  ← T5_N
2번  ← JUMP_ANY_N
3번  PC_LOAD_N → PC 하위 74HC161 9번 /LOAD
                 → PC 상위 74HC161 9번 /LOAD

4번  ← T5_N
5번  ← RUN_N
6번  RUN_T5_N → 74HC74 Z Flag·MONITOR_MODE 13번 /CLR

7번  → GND

8번  HLT_T5_N → 74HC74 KEY_READY·HALT 10번 /PRE
9번  ← T5_N
10번 ← HLT_N

11번 PROG_READ_N → RAM Read AND 칩 1번
                  → RAM Read AND 칩 4번
12번 ← MONITOR_MODE
13번 ← PC_COUNT_N
14번 → +5V
```

---

# 6-15. 74HC32 — Read / Write / BUS 제어

## 연결

```text
1번  ← T5_N
2번  ← READOP_N
3번  DATA_READ_N → RAM Read AND 칩 2번

4번  ← STA_N
5번  ← T5_N
6번  STA_T5_N → RAM쪽 245 #1 1번 DIR
               → RAM Read AND 칩 10번
               → STA·RAM Write·KEY ACK 74HC04 1번
               → Boot·Keyboard·LCD BUS OR 칩 12번

7번  → GND

8번  LDA_T5_N → RAM Read AND 칩 5번
               → Boot·Keyboard·LCD BUS OR 칩 4번
               → Boot·Keyboard·LCD BUS OR 칩 9번
9번  ← LDA_N
10번 ← T5_N

11번 A_ALU_BUS_OE_N → A/ALU 74HC245 19번 /OE
12번 ← T5_N
13번 ← AOUTALU_N
14번 → +5V
```

---

# 6-16. 74HC32 — Boot / Keyboard / LCD BUS 제어

## 연결

```text
1번  ← MONITOR_N
2번  ← PC_COUNT_N
3번  BOOT_ROM_OE_N → Boot ROM 74HC245 19번 /OE

4번  ← LDA_T5_N
5번  ← KEYSEL_N
6번  KEY_READ_N → Keyboard 74HC245 19번 /OE

7번  → GND

8번  KEY_ACK_COND_N → STA·RAM Write·KEY ACK 74HC04 5번
9번  ← LDA_T5_N
10번 ← I/O 주소 74HC138 14번 KEY_DATA_N

11번 LCD_WRITE_N → ALU·SUB·Z·Address·LCD 74HC04 13번
                  → OUT·LCD·PS2 AND 칩 2번
12번 ← STA_T5_N
13번 ← LCDSEL_N
14번 → +5V
```

---

# 6-17. 74HC32 — OUT / Zero Detector 앞단

ALU의 8개 결과 비트가 모두 0인지 검사하는 첫 번째 단계다.

## 연결

```text
1번  ← OUT_N
2번  ← T5_N
3번  OUT_T5_N → OUT·LCD·PS2 AND 칩 1번

4번  ← ALU bit0
5번  ← ALU bit1
6번  ZERO01 → Zero Tree 뒷단 OR 칩 4번

7번  → GND

8번  ZERO23 → Zero Tree 뒷단 OR 칩 5번
9번  ← ALU bit2
10번 ← ALU bit3

11번 ZERO45 → Zero Tree 뒷단 OR 칩 9번
12번 ← ALU bit4
13번 ← ALU bit5
14번 → +5V
```

---

# 6-18. 74HC32 — Zero Detector 뒷단

## 연결

```text
1번  ← ALU bit6
2번  ← ALU bit7
3번  ZERO67 → 같은 칩 10번

4번  ← ZERO01
5번  ← ZERO23
6번  ZERO03 → 같은 칩 12번

7번  → GND

8번  ZERO47 → 같은 칩 13번
9번  ← ZERO45
10번 ← 같은 칩 3번 ZERO67

11번 ZERO_ANY → OUT·ZERO·I/O·PS2·RAM BUS 74HC04 3번
12번 ← ZERO03
13번 ← ZERO47
14번 → +5V
```

`ZERO_ANY`는 ALU 결과 중 하나라도 1이면 HIGH가 된다.
다음 74HC04에서 반전해서 실제 `ZERO` 신호를 만든다.

---

# 6-19. 74HC04 — IR / T-state / A Enable 인버터

## 연결

```text
1번  ← IR7
2번  IR7_N → 기본 명령 74HC139 15번 /2G

3번  ← IR2
4번  IR2_N → 확장명령·PC카운트·LDI OR 칩 5번

5번  ← T1_N
6번  T1 → 확장명령·PC카운트·LDI OR 칩 9번
          → A·IR Clock AND 칩 10번

7번  → GND

8번  T3 → CPU Clock·2바이트 AND 칩 12번
9번  ← T3_N

10번 ACCESS_POS → RAM BUS·A/OUT/ALU AND 칩 4번
11번 ← ACCESS_N

12번 A_EN → A·IR Clock AND 칩 5번
13번 ← A_EN_N
14번 → +5V
```

---

# 6-20. 74HC04 — ALU / SUB / Z / Address / LCD 인버터

## 연결

```text
1번  ← ADD_SUB_N
2번  ALU_SEL → A/ALU 선택 74HC157 두 개의 1번 S

3번  ← SUBCMP_N
4번  SUB_MODE → 두 74HC86의 2,5,10,13번
               → 하위 74HC283 7번 CIN

5번  ← Z_EN_N
6번  Z_EN → SUB·CMP·Z·점프 AND 칩 10번

7번  → GND

8번  ADDR_SEL → 주소 선택 74HC157 두 개의 1번 S
9번  ← ADDR_LOW

10번 PC_COUNT_N → PC LOAD·RUN·HLT·Program Read OR 칩 13번
                 → Boot·Keyboard·LCD BUS OR 칩 2번
11번 ← PC_COUNT

12번 LCD_WRITE → OUT·LCD·PS2 AND 칩 10번
13번 ← LCD_WRITE_N
14번 → +5V
```

이제 4단계에서 수동으로 GND/+5V에 바꾸던 `SUB_MODE`와 `ALU_SELECT`가 자동으로 만들어진다.

---

# 6-21. 74HC04 — OUT / ZERO / I/O / PS2 / RAM BUS 인버터

## 연결

```text
1번  ← OUT_EN_N
2번  OUT_EN → OUT·LCD·PS2 AND 칩 5번

3번  ← ZERO_ANY
4번  ZERO → 74HC74 Z Flag·MONITOR_MODE 2번 D

5번  ← ADDRESS A3
6번  A3_N → I/O 주소 74HC138 6번 G1

7번  → GND

8번  QC_N → OUT·LCD·PS2 AND 칩 13번
9번  ← PS/2 비트 카운터 12번 QC

10번 LOWPAIR → PS2·RAM Write Pulse AND 칩 1번
11번 ← LOWPAIR_N

12번 RAM_BUS_OE_N → RAM쪽 245 #1 19번 /OE
13번 ← RAM_BUS_ENABLE_POS
14번 → +5V
```

---

# 6-22. 74HC04 — STA / RAM Write / KEY ACK 인버터

## 연결

```text
1번  ← STA_T5_N
2번  STA_T5 → PS2·RAM Write Pulse AND 칩 13번

3번  ← RAM_WRITE_PULSE
4번  RAM_MWR_N → RAM #1~#5 17번 MWR

5번  ← KEY_ACK_COND_N
6번  KEY_ACK_COND → Keyboard·LCD·ACK AND 칩 5번

7번  → GND

8번  KEY_ACK_PULSE_N → Keyboard·LCD·ACK AND 칩 10번
9번  ← KEY_ACK_PULSE

10번 = 미사용 출력
11번 미사용 입력 → GND
12번 = 미사용 출력
13번 미사용 입력 → GND
14번 → +5V
```

---

# 6-23. 제어회로 테스트 순서

이 단계는 전체 CPU를 바로 돌려서 시험하면 문제 위치를 찾기 어렵다.
다음 순서를 지킨다.

## 1. 각 게이트 단독 테스트

### 74HC08

각 게이트에 수동 HIGH/LOW를 넣어:

```text
0 AND 0 = 0
0 AND 1 = 0
1 AND 0 = 0
1 AND 1 = 1
```

인지 확인한다.

### 74HC32

```text
0 OR 0 = 0
0 OR 1 = 1
1 OR 0 = 1
1 OR 1 = 1
```

인지 확인한다.

### 74HC04

```text
입력 LOW  → 출력 HIGH
입력 HIGH → 출력 LOW
```

인지 확인한다.

## 2. Clock 계열 확인

다음 신호가 **필요할 때만** Clock pulse를 만드는지 확인한다.

```text
CPU_CLK
MAR_CLK
A_CLK
IR_CLK
Z_CLK
OUT_CLK
```

## 3. RAM 제어 확인

다음 실제 핀에서 상태를 확인한다.

```text
RAM #1~#5 16번 MRD
RAM #1~#5 17번 MWR
RAM쪽 245 #1 19번 /OE
RAM쪽 245 #1 1번 DIR
```

읽기와 쓰기가 동시에 켜지지 않는지 확인한다.

## 4. DATA BUS 충돌 확인

DATA BUS에 연결된 74HC245의 19번 `/OE`를 모두 확인한다.

한 순간에 서로 다른 두 장치의 `/OE`가 동시에 LOW가 되면 안 된다.

특히 확인할 것:

```text
RAM쪽 245 #1 19번
A/ALU 245 19번
Boot ROM 245 19번
Keyboard 245 19번
수동 입력 245 #2 19번
```

자동 실행을 시작하기 전에는 수동 입력 245 #2의 19번을 +5V로 두어 꺼놓는 것이 안전하다.

## 5. Zero Detector 확인

```text
ALU = 00000000 → ZERO = HIGH
ALU ≠ 00000000 → ZERO = LOW
```

인지 확인한다.

---

# 6단계 완료 체크

- [ ] RUN_EN에 따라 CPU_CLK가 통과/차단됨
- [ ] MAR_CLK 정상
- [ ] A_CLK 정상
- [ ] IR_CLK 정상
- [ ] OUT_CLK 정상
- [ ] SUB_MODE 자동 제어 정상
- [ ] ALU_SEL 자동 제어 정상
- [ ] ADDR_SEL 자동 제어 정상
- [ ] RAM 16번 MRD 자동 제어 정상
- [ ] RAM 17번 MWR 자동 제어 정상
- [ ] RAM쪽 245 #1 방향/활성 제어 정상
- [ ] DATA BUS Driver 충돌 없음
- [ ] ZERO 신호 정상

## 다음 단계

[07_Flag_BootROM.md](./07_Flag_BootROM.md)