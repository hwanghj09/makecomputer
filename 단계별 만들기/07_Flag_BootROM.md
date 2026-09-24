# 7단계 — Zero Flag, Monitor Mode, HALT, KEY_READY, Boot ROM

이번 단계에서는 CPU가 계산 결과와 실행 상태를 **1비트로 기억**할 수 있게 하고, 전원을 켰을 때 실행할 Monitor 프로그램용 Boot ROM을 연결한다.

순서:

```text
74HC74 Z Flag / MONITOR_MODE
↓
74HC74 KEY_READY / HALT
↓
AT28C64B Boot ROM
↓
74HC245 Boot ROM DATA BUS 드라이버
```

---

# 7-1. Flag와 Mode가 무엇인가

이 컴퓨터는 다음 상태를 기억한다.

```text
Z             = ALU 계산 결과가 0인지
MONITOR_MODE  = Boot ROM Monitor를 실행 중인지
KEY_READY     = 키보드 데이터 한 글자가 준비됐는지
HALT          = CPU가 멈춘 상태인지
RUN_EN        = CPU Clock을 계속 허용할지
```

이런 값들은 8비트 DATA가 아니라 **1비트 상태값**이다.

74HC74 한 개에는 D Flip-Flop 두 개가 들어 있다.

---

# 7-2. 74HC74 — Z Flag / MONITOR_MODE

## 전원

```text
7번 GND → GND
14번 VCC → +5V
```

14번과 7번 사이에 0.1µF를 연결한다.

---

## 앞쪽 Flip-Flop = Z Flag

```text
1번 /CLR ← RESET_N
2번 D ← 6단계 Zero Detector의 ZERO
3번 CLK ← Z_CLK
4번 /PRE → +5V
5번 Q = Z → 74HC32 A·Z·조건점프 OR 칩 13번
6번 /Q = Z_N → 같은 OR 칩 10번
```

`/CLR`와 `/PRE`는 Active-Low다.

### Z Flag 동작

`2번 D`의 값을 `3번 CLK` 상승 에지에서 저장한다.

```text
ZERO = HIGH
Z_CLK 상승
→ 5번 Z = HIGH

ZERO = LOW
Z_CLK 상승
→ 5번 Z = LOW
```

## Z Flag 테스트

1. RESET 상태를 해제한다.
2. 2번 D를 +5V로 만든다.
3. 3번 CLK에 한 번의 상승 에지를 준다.
4. 5번 Q가 HIGH인지 확인한다.
5. 2번 D를 GND로 바꾼다.
6. 3번 CLK에 다시 상승 에지를 준다.
7. 5번 Q가 LOW인지 확인한다.

---

## 뒤쪽 Flip-Flop = MONITOR_MODE

```text
8번 /Q = MONITOR_N → Boot·Keyboard·LCD BUS 74HC32 1번
9번 Q = MONITOR_MODE → PC LOAD·RUN·HLT·Program Read 74HC32 12번
10번 /PRE ← RESET_N
11번 CLK → GND
12번 D → GND
13번 /CLR ← RUN_T5_N
```

### 왜 Reset에서 MONITOR_MODE가 1이 되나?

10번 `/PRE`가 LOW가 되면 Q가 1로 설정된다.

따라서 Reset 시:

```text
MONITOR_MODE = 1
MONITOR_N = 0
```

이 된다.

### 왜 RUN 후 0이 되나?

`RUN_T5_N`이 LOW가 되면 13번 `/CLR`가 활성화되어:

```text
MONITOR_MODE = 0
```

으로 바뀐다.

## MONITOR_MODE 테스트

1. Reset을 건다.
2. 9번 Q가 HIGH인지 확인한다.
3. Reset을 해제한다.
4. 13번 `/CLR`를 잠깐 GND로 내려 RUN 조건을 흉내 낸다.
5. 9번 Q가 LOW로 바뀌는지 확인한다.

> 같은 Flip-Flop의 `/PRE`와 `/CLR`를 동시에 LOW로 만들지 않는다.

---

# 7-3. 74HC74 — KEY_READY / HALT

## 전원

```text
7번 GND → GND
14번 VCC → +5V
```

14번과 7번 사이에 0.1µF를 연결한다.

---

## 앞쪽 Flip-Flop = KEY_READY

```text
1번 /CLR ← KEY_CLR_N
2번 D → +5V
3번 CLK ← FRAME_CLK
4번 /PRE → +5V
5번 Q = KEY_READY → 키보드 STATUS/DATA 74HC157 하위칩 2번
                    → NPN Clock Hold Base 저항
6번 /Q = KEY_READY_N → PS/2·RAM Write Pulse 74HC08 5번
```

키보드 프레임 하나를 정상적으로 받으면 3번 FRAME_CLK가 들어오고, D가 항상 HIGH이므로 KEY_READY가 1로 저장된다.

`KEY_CLR_N`이 LOW가 되면 다시 0으로 지워진다.

KEY_READY의 최종 테스트는 9단계에서 한다.

---

## 뒤쪽 Flip-Flop = HALT

```text
8번 /Q = RUN_EN → CPU Clock·2바이트 74HC08 2번
9번 Q = HALT → 상태 확인용
10번 /PRE ← HLT_T5_N
11번 CLK → GND
12번 D → GND
13번 /CLR ← RESET_N
```

### HALT 동작

HLT 명령의 마지막 단계에서 10번 `/PRE`가 LOW가 되면:

```text
HALT = HIGH
RUN_EN = LOW
```

가 된다.

RUN_EN이 LOW가 되면 6단계 CPU Clock AND 회로에서 Clock이 차단된다.

Reset에서는 13번 `/CLR`가 LOW가 되어 HALT를 지운다.

```text
HALT = LOW
RUN_EN = HIGH
```

## HALT 테스트

1. Reset 후 8번 RUN_EN이 HIGH인지 확인한다.
2. 10번 `/PRE`를 잠깐 GND로 내린다.
3. 9번 HALT가 HIGH인지 확인한다.
4. 8번 RUN_EN이 LOW인지 확인한다.
5. Reset을 걸어 다시 RUN_EN이 HIGH가 되는지 확인한다.

---

# 7-4. Boot ROM이 필요한 이유

현재 사용하는 RAM은 전원을 끄면 저장한 프로그램이 유지되지 않는다.

그래서 전원을 켰을 때 항상 실행할 Monitor 프로그램은 EEPROM에 저장한다.

Reset 직후:

```text
MONITOR_MODE = 1
PC = 0
↓
Boot ROM 주소 0부터 명령어 Fetch
```

사용자가 Monitor의 `RUN` 기능으로 RAM 프로그램을 시작하면:

```text
MONITOR_MODE = 0
```

이 되고 이후 명령 Fetch는 RAM에서 이루어진다.

---

# 7-5. AT28C64B Monitor Boot ROM

이 설계에서는 AT28C64B 전체 용량을 다 쓰지 않고 주소 `A0~A7`만 사용한다.
상위 주소핀은 GND에 고정한다.

## 주소 입력

```text
3번  A7 ← PC 상위 74HC161 11번 QD = PC7
4번  A6 ← PC 상위 74HC161 12번 QC = PC6
5번  A5 ← PC 상위 74HC161 13번 QB = PC5
6번  A4 ← PC 상위 74HC161 14번 QA = PC4
7번  A3 ← PC 하위 74HC161 11번 QD = PC3
8번  A2 ← PC 하위 74HC161 12번 QC = PC2
9번  A1 ← PC 하위 74HC161 13번 QB = PC1
10번 A0 ← PC 하위 74HC161 14번 QA = PC0
```

## 사용하지 않는 상위 주소

```text
2번  A12 → GND
21번 A10 → GND
23번 A11 → GND
24번 A9  → GND
25번 A8  → GND
```

## 데이터 출력

```text
11번 I/O0 → Boot ROM 74HC245 2번 A1
12번 I/O1 → Boot ROM 74HC245 3번 A2
13번 I/O2 → Boot ROM 74HC245 4번 A3
15번 I/O3 → Boot ROM 74HC245 5번 A4
16번 I/O4 → Boot ROM 74HC245 6번 A5
17번 I/O5 → Boot ROM 74HC245 7번 A6
18번 I/O6 → Boot ROM 74HC245 8번 A7
19번 I/O7 → Boot ROM 74HC245 9번 A8
```

## 제어와 전원

```text
14번 GND → GND
20번 /CE → GND
22번 /OE → GND
27번 /WE → +5V
28번 VCC → +5V
```

```text
1번 NC → 연결하지 않음
26번 NC → 연결하지 않음
```

28번과 14번 사이에 0.1µF를 연결한다.

### 왜 /WE는 +5V인가?

컴퓨터 동작 중에는 Boot ROM에 쓰지 않고 **읽기만** 할 것이기 때문이다.

---

# 7-6. 74HC245 Boot ROM DATA BUS 드라이버

Boot ROM의 출력이 항상 DATA BUS를 잡고 있으면 RAM이나 ALU와 충돌한다.
그래서 74HC245를 사이에 둔다.

## 전원과 방향

```text
1번 DIR → +5V
10번 GND → GND
20번 VCC → +5V
```

방향은 A→B로 고정한다.

## Boot ROM → A쪽

```text
2번 A1 ← Boot ROM 11번 I/O0
3번 A2 ← Boot ROM 12번 I/O1
4번 A3 ← Boot ROM 13번 I/O2
5번 A4 ← Boot ROM 15번 I/O3
6번 A5 ← Boot ROM 16번 I/O4
7번 A6 ← Boot ROM 17번 I/O5
8번 A7 ← Boot ROM 18번 I/O6
9번 A8 ← Boot ROM 19번 I/O7
```

## B쪽 → CPU DATA BUS

```text
18번 B1 → DB0
17번 B2 → DB1
16번 B3 → DB2
15번 B4 → DB3
14번 B5 → DB4
13번 B6 → DB5
12번 B7 → DB6
11번 B8 → DB7
```

## 출력 Enable

```text
19번 /OE ← 74HC32 Boot·Keyboard·LCD BUS 제어 OR 칩 3번 BOOT_ROM_OE_N
```

```text
19번 LOW  → Boot ROM이 DATA BUS를 구동
19번 HIGH → Boot ROM이 DATA BUS에서 분리
```

20번과 10번 사이에 0.1µF를 연결한다.

---

# 7-7. Boot ROM 단독 테스트

EEPROM Programmer로 눈에 띄는 테스트 데이터를 먼저 기록한다.

```text
주소 0 = 0xAA = 10101010
주소 1 = 0x55 = 01010101
주소 2 = 0xF0 = 11110000
```

## 1. EEPROM 자체 출력 확인

PC 주소를 수동으로 바꾸며 Boot ROM `I/O7~I/O0`을 확인한다.

```text
PC=0 → AA
PC=1 → 55
PC=2 → F0
```

## 2. Boot ROM 245 확인

다른 DATA BUS Driver를 모두 끈 상태에서 Boot ROM 245의 19번 `/OE`를 LOW로 한다.

그러면 DATA BUS에도 같은 값이 나와야 한다.

```text
19번 LOW  → DB7~DB0에 ROM 값 출력
19번 HIGH → DATA BUS에서 분리
```

---

# 7단계 완료 체크

- [ ] Z Flag가 ZERO 값을 Clock에서 저장
- [ ] Reset 후 MONITOR_MODE=1
- [ ] RUN 조건 후 MONITOR_MODE=0
- [ ] Reset 후 RUN_EN=1
- [ ] HLT 조건 후 RUN_EN=0
- [ ] Boot ROM A0~A7과 PC0~PC7 연결 정상
- [ ] Boot ROM 테스트 데이터 AA/55/F0 정상
- [ ] Boot ROM 74HC245 19번 /OE ON/OFF 정상

## 다음 단계

[08_IO_LCD.md](./08_IO_LCD.md)