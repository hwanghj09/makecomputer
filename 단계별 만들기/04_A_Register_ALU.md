# 4단계 — A 레지스터와 8비트 ALU

이번 단계에서는 CPU가 실제 숫자를 저장하고 **더하기/빼기**를 할 수 있게 만든다.

완성 흐름:

```text
DATA BUS
   ↓
74HC273 A 레지스터
   ↓
A 입력 ─────────────┐
                    │
RAM_D0~7 → 74HC86 → 74HC283 두 개 → ALU 결과
                    │
A 레지스터 ─────────┘
          ↓
74HC157 A/ALU 선택 MUX 두 개
          ↓
74HC245 A/ALU 버스 드라이버
          ↓
DATA BUS
```

---

# 먼저 이름부터 구분

이 단계에서 가장 헷갈리는 부분은 `DB0`와 `RAM_D0`이다.

```text
DB0~DB7     = CPU 공용 DATA BUS
RAM_D0~D7   = RAM과 245 #1 사이의 RAM 전용 데이터선
```

예를 들어:

```text
DB0    = RAM쪽 245 #1의 18번 B1 쪽
RAM_D0 = RAM쪽 245 #1의 2번 A1 쪽
```

ALU의 B 입력에는 **DB가 아니라 RAM_D0~RAM_D7**이 들어간다.

---

# 4-1. 74HC273 A 레지스터

A 레지스터는 계산의 기준이 되는 8비트 값을 기억한다.

## 전원과 제어

```text
A 레지스터 1번 /CLR → RESET 선
A 레지스터 10번 GND → GND
A 레지스터 11번 CLK → 지금은 수동 A_CLK 테스트선
A 레지스터 20번 VCC → +5V
```

20번과 10번 사이에 0.1µF를 연결한다.

`1번 /CLR`는 Active-Low다.

```text
1번 HIGH → 정상 동작
1번 LOW  → Q0~Q7을 00000000으로 초기화
```

## DATA BUS → A 레지스터 입력

```text
DB0 → A 레지스터 3번 D0
DB1 → A 레지스터 4번 D1
DB2 → A 레지스터 7번 D2
DB3 → A 레지스터 8번 D3
DB4 → A 레지스터 13번 D4
DB5 → A 레지스터 14번 D5
DB6 → A 레지스터 17번 D6
DB7 → A 레지스터 18번 D7
```

## A 레지스터 출력

```text
2번  Q0
5번  Q1
6번  Q2
9번  Q3
12번 Q4
15번 Q5
16번 Q6
19번 Q7
```

하나의 Q 출력은 여러 칩의 **입력**으로 분기해도 된다.
예를 들어 A 레지스터 19번 Q7에 이미 다른 입력이 연결되어 있어도 같은 전기적 줄에서 74HC283 입력으로 한 선을 더 빼도 된다.

단, **출력과 출력을 서로 직접 묶으면 안 된다.**

---

# 4-2. A 레지스터 단독 테스트

RAM쪽 245 #1은 DATA BUS에서 꺼둔다.

```text
245 #1 19번 → +5V
```

푸시버튼쪽 245 #2로 DATA BUS를 만든다.

```text
245 #2 1번  → +5V
245 #2 19번 → GND
```

푸시버튼으로:

```text
00110101
```

을 만든다.

A 레지스터 11번 CLK에 상승 에지를 한 번 준다.

```text
GND → +5V
```

그러면 Q7~Q0은:

```text
00110101
```

이 되어야 한다.

핀별 예상값:

```text
2번  Q0 = HIGH
5번  Q1 = LOW
6번  Q2 = HIGH
9번  Q3 = LOW
12번 Q4 = HIGH
15번 Q5 = HIGH
16번 Q6 = LOW
19번 Q7 = LOW
```

그 다음 푸시버튼 값을 바꿔도 **A 레지스터 11번에 다음 Clock을 주기 전까지 Q값이 유지**되어야 한다.

---

# 4-3. SUB_MODE가 무엇인가

74HC283은 원래 덧셈기다.
뺄셈은 다음 원리를 사용한다.

```text
A - B = A + NOT(B) + 1
```

그래서 RAM 데이터 B를 74HC86 XOR에 통과시킨다.

```text
SUB_MODE = LOW(GND)
→ B 그대로
→ A + B

SUB_MODE = HIGH(+5V)
→ B 반전
→ 하위 74HC283의 CIN도 1
→ A + NOT(B) + 1
→ A - B
```

`SUB_MODE`는 하나의 공통 제어선이다.

기존에 SUB_MODE를 +5V에 고정한 선이 있다면 제거하고, 테스트할 때 **GND 또는 +5V 중 하나만** 선택해서 연결한다.

---

# 4-4. 하위 74HC86 — RAM_D0~RAM_D3

74HC86 전원:

```text
7번 GND → GND
14번 VCC → +5V
```

14번과 7번 사이에 0.1µF를 연결한다.

## 입력/출력

```text
RAM_D0 → 하위 XOR 1번
SUB_MODE → 하위 XOR 2번
하위 XOR 3번 → 하위 74HC283 6번 B0

RAM_D1 → 하위 XOR 4번
SUB_MODE → 하위 XOR 5번
하위 XOR 6번 → 하위 74HC283 2번 B1

RAM_D2 → 하위 XOR 9번
SUB_MODE → 하위 XOR 10번
하위 XOR 8번 → 하위 74HC283 15번 B2

RAM_D3 → 하위 XOR 12번
SUB_MODE → 하위 XOR 13번
하위 XOR 11번 → 하위 74HC283 11번 B3
```

RAM_D0~D3를 RAM쪽 245 #1 기준으로 보면:

```text
RAM_D0 = 245 #1 2번 A1
RAM_D1 = 245 #1 3번 A2
RAM_D2 = 245 #1 4번 A3
RAM_D3 = 245 #1 5번 A4
```

---

# 4-5. 상위 74HC86 — RAM_D4~RAM_D7

전원:

```text
7번 GND → GND
14번 VCC → +5V
```

## 입력/출력

```text
RAM_D4 → 상위 XOR 1번
SUB_MODE → 상위 XOR 2번
상위 XOR 3번 → 상위 74HC283 6번 B0

RAM_D5 → 상위 XOR 4번
SUB_MODE → 상위 XOR 5번
상위 XOR 6번 → 상위 74HC283 2번 B1

RAM_D6 → 상위 XOR 9번
SUB_MODE → 상위 XOR 10번
상위 XOR 8번 → 상위 74HC283 15번 B2

RAM_D7 → 상위 XOR 12번
SUB_MODE → 상위 XOR 13번
상위 XOR 11번 → 상위 74HC283 11번 B3
```

RAM쪽 245 #1 기준:

```text
RAM_D4 = 245 #1 6번 A5
RAM_D5 = 245 #1 7번 A6
RAM_D6 = 245 #1 8번 A7
RAM_D7 = 245 #1 9번 A8
```

두 XOR 칩의 `2, 5, 10, 13번`은 모두 **같은 SUB_MODE 공통선**에 연결한다.

---

# 4-6. XOR 단독 테스트

예를 들어 RAM_D3~D0에:

```text
0101
```

이 들어 있다고 하자.

## SUB_MODE = GND

하위 XOR 출력은 그대로:

```text
0101
```

이어야 한다.

출력핀:

```text
3번  = bit0
6번  = bit1
8번  = bit2
11번 = bit3
```

## SUB_MODE = +5V

출력은 반전되어:

```text
1010
```

이 되어야 한다.

상위 XOR도 같은 방법으로 확인한다.

---

# 4-7. 하위 74HC283 — bit0~bit3

하위 74HC283 전원:

```text
8번 GND → GND
16번 VCC → +5V
```

16번과 8번 사이에 0.1µF를 연결한다.

## A 레지스터 하위 4비트 → 74HC283 A 입력

```text
A 레지스터 2번 Q0 → 하위 74HC283 5번 A0
A 레지스터 5번 Q1 → 하위 74HC283 3번 A1
A 레지스터 6번 Q2 → 하위 74HC283 14번 A2
A 레지스터 9번 Q3 → 하위 74HC283 12번 A3
```

## XOR 출력 → B 입력

```text
하위 XOR 3번  → 하위 74HC283 6번 B0
하위 XOR 6번  → 하위 74HC283 2번 B1
하위 XOR 8번  → 하위 74HC283 15번 B2
하위 XOR 11번 → 하위 74HC283 11번 B3
```

## Carry 입력

```text
하위 74HC283 7번 CIN → SUB_MODE
```

따라서 덧셈에서는 CIN=0, 뺄셈에서는 CIN=1이 된다.

## 하위 결과

```text
4번  S0 = ALU bit0
1번  S1 = ALU bit1
13번 S2 = ALU bit2
10번 S3 = ALU bit3
9번  COUT → 상위 74HC283 7번 CIN
```

---

# 4-8. 상위 74HC283 — bit4~bit7

전원:

```text
8번 GND → GND
16번 VCC → +5V
```

## A 레지스터 상위 4비트

```text
A 레지스터 12번 Q4 → 상위 74HC283 5번 A0
A 레지스터 15번 Q5 → 상위 74HC283 3번 A1
A 레지스터 16번 Q6 → 상위 74HC283 14번 A2
A 레지스터 19번 Q7 → 상위 74HC283 12번 A3
```

## 상위 XOR 출력

```text
상위 XOR 3번  → 상위 74HC283 6번 B0
상위 XOR 6번  → 상위 74HC283 2번 B1
상위 XOR 8번  → 상위 74HC283 15번 B2
상위 XOR 11번 → 상위 74HC283 11번 B3
```

## 하위 Carry 연결

```text
하위 74HC283 9번 COUT
        ↓
상위 74HC283 7번 CIN
```

## 상위 결과

```text
4번  S0 = ALU bit4
1번  S1 = ALU bit5
13번 S2 = ALU bit6
10번 S3 = ALU bit7
9번  COUT = 현재 사용하지 않음
```

---

# 4-9. 8비트 ALU 테스트

전체 결과핀은:

```text
bit0 = 하위 74HC283 4번
bit1 = 하위 74HC283 1번
bit2 = 하위 74HC283 13번
bit3 = 하위 74HC283 10번
bit4 = 상위 74HC283 4번
bit5 = 상위 74HC283 1번
bit6 = 상위 74HC283 13번
bit7 = 상위 74HC283 10번
```

## 덧셈 테스트: 5 + 3 = 8

A 레지스터:

```text
A = 00000101
```

RAM_D7~D0:

```text
00000011
```

SUB_MODE:

```text
SUB_MODE → GND
```

결과:

```text
ALU = 00001000
```

이어야 한다.

## 뺄셈 테스트: 5 - 3 = 2

A와 RAM_D는 그대로 둔다.

```text
SUB_MODE → +5V
```

결과:

```text
ALU = 00000010
```

이어야 한다.

둘 다 성공한 뒤 MUX를 연결한다.

---

# 4-10. 74HC157 A/ALU 선택 MUX 하위칩

이 MUX는 DATA BUS에 **A 레지스터 값**을 보낼지 **ALU 결과**를 보낼지 고른다.

```text
ALU_SELECT = LOW  → A 레지스터
ALU_SELECT = HIGH → ALU 결과
```

## 기본 연결

```text
8번 GND → GND
15번 /G → GND
16번 VCC → +5V
1번 S → ALU_SELECT
```

## 하위 4비트

```text
2번 1A ← A 레지스터 Q0
3번 1B ← ALU bit0
4번 1Y → A/ALU 74HC245 2번 A1

5번 2A ← A 레지스터 Q1
6번 2B ← ALU bit1
7번 2Y → A/ALU 74HC245 3번 A2

11번 3A ← A 레지스터 Q2
10번 3B ← ALU bit2
9번 3Y → A/ALU 74HC245 4번 A3

14번 4A ← A 레지스터 Q3
13번 4B ← ALU bit3
12번 4Y → A/ALU 74HC245 5번 A4
```

---

# 4-11. 74HC157 A/ALU 선택 MUX 상위칩

```text
8번 GND → GND
15번 /G → GND
16번 VCC → +5V
1번 S → 하위 MUX와 같은 ALU_SELECT
```

## 상위 4비트

```text
2번 1A ← A 레지스터 Q4
3번 1B ← ALU bit4
4번 1Y → A/ALU 74HC245 6번 A5

5번 2A ← A 레지스터 Q5
6번 2B ← ALU bit5
7번 2Y → A/ALU 74HC245 7번 A6

11번 3A ← A 레지스터 Q6
10번 3B ← ALU bit6
9번 3Y → A/ALU 74HC245 8번 A7

14번 4A ← A 레지스터 Q7
13번 4B ← ALU bit7
12번 4Y → A/ALU 74HC245 9번 A8
```

두 74HC157 모두 VCC-GND 사이에 0.1µF를 연결한다.

---

# 4-12. A/ALU용 74HC245

이 74HC245는 선택된 A 또는 ALU 값을 DATA BUS에 내보낸다.

방향은 항상 A→B로 사용한다.

```text
1번 DIR → +5V
10번 GND → GND
20번 VCC → +5V
```

## A쪽 입력

```text
2번 A1 ← 하위 MUX 4번  = bit0
3번 A2 ← 하위 MUX 7번  = bit1
4번 A3 ← 하위 MUX 9번  = bit2
5번 A4 ← 하위 MUX 12번 = bit3
6번 A5 ← 상위 MUX 4번  = bit4
7번 A6 ← 상위 MUX 7번  = bit5
8번 A7 ← 상위 MUX 9번  = bit6
9번 A8 ← 상위 MUX 12번 = bit7
```

## DATA BUS쪽

```text
18번 B1 ↔ DB0
17번 B2 ↔ DB1
16번 B3 ↔ DB2
15번 B4 ↔ DB3
14번 B5 ↔ DB4
13번 B6 ↔ DB5
12번 B7 ↔ DB6
11번 B8 ↔ DB7
```

## 출력 활성 핀

```text
19번 /OE
```

```text
19번 HIGH(+5V) → DATA BUS에서 분리
19번 LOW(GND)  → 선택된 A/ALU 값을 DATA BUS에 출력
```

20번과 10번 사이에 0.1µF를 연결한다.

---

# 4-13. 최종 테스트

먼저 다른 DATA BUS 드라이버를 모두 꺼둔다.

예:

```text
RAM쪽 245 #1 19번 → +5V
푸시버튼쪽 245 #2 19번 → +5V
```

A와 ALU 결과를 서로 다르게 만든다.

## A 선택

```text
두 A/ALU MUX 1번 S → GND
A/ALU 74HC245 19번 → GND
```

DATA BUS에 A 레지스터 값이 나와야 한다.

## ALU 선택

```text
두 A/ALU MUX 1번 S → +5V
A/ALU 74HC245 19번 → GND
```

DATA BUS에 ALU 결과가 나와야 한다.

테스트가 끝나면:

```text
A/ALU 74HC245 19번 → +5V
```

로 다시 DATA BUS에서 분리한다.

---

# 4단계 완료 체크

- [ ] A 레지스터가 DATA BUS 값을 저장하고 유지
- [ ] 하위 XOR 반전 정상
- [ ] 상위 XOR 반전 정상
- [ ] SUB_MODE=LOW에서 덧셈
- [ ] SUB_MODE=HIGH에서 뺄셈
- [ ] 5+3=8
- [ ] 5-3=2
- [ ] A/ALU MUX 선택 정상
- [ ] A/ALU 74HC245를 켰을 때만 DATA BUS에 출력

## 다음 단계

[05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md)