# 2단계 — PC → MAR → 주소 선택 MUX → RAM 뱅크 디코더

이번 단계에서는 CPU가 **어느 메모리 주소를 보고 있는지** 결정하는 부분을 만든다.

완성 흐름은 다음과 같다.

```text
74HC161 PC 하위 4비트
+
74HC161 PC 상위 4비트
        ↓
     8비트 PC
        ↓
PC 주소 ─────────┐
                 ├→ 74HC157 주소 선택 MUX 2개 → ADDRESS A0~A7
MAR 주소 ────────┘
                                      ↓
                               74HC138 RAM 뱅크 디코더
```

아직 RAM 칩 자체는 연결하지 않는다.

---

# 먼저 알아둘 것

## PC란?

`Program Counter`는 **다음에 실행할 명령어가 있는 주소**를 기억한다.

8비트이므로:

```text
PC7 PC6 PC5 PC4 PC3 PC2 PC1 PC0
```

총 `0~255` 주소를 표현할 수 있다.

## MAR란?

`Memory Address Register`는 RAM을 읽거나 쓸 때 사용할 주소를 잠깐 저장하는 8비트 레지스터다.

## 주소 선택 MUX란?

PC 주소와 MAR 주소 중 어느 것을 실제 ADDRESS BUS에 보낼지 고른다.

```text
MUX Select = LOW(GND)  → PC 선택
MUX Select = HIGH(+5V) → MAR 선택
```

---

# 2-1. 74HC161 PC 하위 4비트 만들기

먼저 PC0~PC3만 만든다.

74HC161 핀:

```text
              홈
         ┌─────────┐
 /CLR  1 │         │16 VCC
 CLK   2 │ 74HC161 │15 RCO
 A     3 │         │14 QA
 B     4 │         │13 QB
 C     5 │         │12 QC
 D     6 │         │11 QD
 ENP   7 │         │10 ENT
 GND   8 │         │9 /LOAD
         └─────────┘
```

## 지금 연결

```text
1번 /CLR  → +5V
2번 CLK   ← NE555 3번 OUT
3번 A     → GND
4번 B     → GND
5번 C     → GND
6번 D     → GND
7번 ENP   → +5V
8번 GND   → GND
9번 /LOAD → +5V
10번 ENT  → +5V
14번 QA   = PC0
13번 QB   = PC1
12번 QC   = PC2
11번 QD   = PC3
15번 RCO  → 지금은 연결하지 않음
16번 VCC  → +5V
```

그리고 16번 VCC와 8번 GND 사이에 0.1µF 커패시터를 연결한다.

### 왜 3~6번을 GND에 두나?

3~6번은 나중에 `/LOAD`를 이용해 PC에 값을 한 번에 넣을 때 쓰는 입력이다.
지금은 단순 카운트 테스트만 하므로 `0000`으로 고정한다.

### 왜 9번 /LOAD는 +5V인가?

`/LOAD`는 Active-Low다.

```text
9번 HIGH → 일반 카운트
9번 LOW  → 3~6번 A~D 값을 PC에 Load
```

지금은 일반 카운트만 할 것이므로 +5V다.

## 테스트

QA~QD에 LED를 달 경우 각 LED에는 330Ω~1kΩ 저항을 사용한다.

Clock을 느리게 하고 다음처럼 증가하는지 확인한다.

```text
0000
0001
0010
0011
...
1111
0000
```

Reset도 확인한다.

```text
74HC161 1번 /CLR
+5V → GND → +5V
```

GND로 내렸을 때 바로 `0000`이 되어야 한다.

---

# 2-2. 74HC161 PC 상위 4비트 추가

두 번째 74HC161이 PC4~PC7을 담당한다.

## 상위 74HC161 연결

```text
1번 /CLR  → 하위 74HC161 1번과 같은 Reset 선
2번 CLK   ← NE555 3번 OUT
3번 A     → GND
4번 B     → GND
5번 C     → GND
6번 D     → GND
7번 ENP   → +5V
8번 GND   → GND
9번 /LOAD → +5V
10번 ENT  ← 하위 74HC161 15번 RCO
14번 QA   = PC4
13번 QB   = PC5
12번 QC   = PC6
11번 QD   = PC7
15번 RCO  → 현재 사용하지 않음
16번 VCC  → +5V
```

상위칩도 16번과 8번 사이에 0.1µF를 연결한다.

## 아주 중요한 연결

```text
하위 74HC161 15번 RCO
        ↓
상위 74HC161 10번 ENT
```

**상위 74HC161의 CLK를 하위 RCO에 연결하는 것이 아니다.**
두 74HC161의 2번 CLK는 모두 같은 Clock을 받는다.

하위 74HC161의 10번 ENT는 계속 +5V다.

## 8비트 PC 테스트

특히 이 부분을 확인한다.

```text
00001110 = 14
00001111 = 15
00010000 = 16
00010001 = 17
```

`00001111 → 00010000`이 정확히 되면 하위/상위 연결이 정상이다.

---

# 2-3. 74HC273 MAR 만들기

MAR는 8비트 주소를 저장한다.

74HC273 핀:

```text
                 홈
            ┌───────────┐
 /CLR    1  │           │20 VCC
 Q0      2  │ 74HC273   │19 Q7
 D0      3  │           │18 D7
 D1      4  │           │17 D6
 Q1      5  │           │16 Q6
 Q2      6  │           │15 Q5
 D2      7  │           │14 D5
 D3      8  │           │13 D4
 Q3      9  │           │12 Q4
 GND    10  │           │11 CLK
            └───────────┘
```

## 기본 연결

```text
1번 /CLR → +5V
10번 GND → GND
11번 CLK → 수동 테스트용 Clock
20번 VCC → +5V
```

20번과 10번 사이에 0.1µF를 연결한다.

## 테스트용 입력

```text
3번  D0 ← bit0
4번  D1 ← bit1
7번  D2 ← bit2
8번  D3 ← bit3
13번 D4 ← bit4
14번 D5 ← bit5
17번 D6 ← bit6
18번 D7 ← bit7
```

각 입력은 테스트할 때 반드시 `+5V(HIGH)` 또는 `GND(LOW)` 중 하나에 연결한다. 떠 있게 두지 않는다.

## MAR 출력

```text
2번  Q0 = MAR0
5번  Q1 = MAR1
6번  Q2 = MAR2
9번  Q3 = MAR3
12번 Q4 = MAR4
15번 Q5 = MAR5
16번 Q6 = MAR6
19번 Q7 = MAR7
```

## 테스트

예를 들어 D7~D0을:

```text
10100101
```

로 만든다.

그다음 11번 CLK에 한 번의 상승 에지를 준다.

```text
GND → +5V
```

그러면 Q7~Q0에도 `10100101`이 저장되어야 한다.

그 뒤 D 입력을 다른 값으로 바꿔도 **다음 Clock을 주기 전까지 Q 출력은 그대로 유지**되어야 한다.

1번 `/CLR`를 잠깐 GND로 내리면 Q7~Q0이 모두 0이 되어야 한다.

> MAR의 D0~D7 입력은 다음 단계에서 DATA BUS에 연결한다. 지금은 테스트용 입력만 사용한다.

---

# 2-4. 74HC157 주소 선택 MUX 하위칩

하위 MUX는 주소 A0~A3을 만든다.

## 기본 연결

```text
8번 GND → GND
15번 /G → GND
16번 VCC → +5V
```

15번 `/G`는 LOW일 때 출력이 활성화된다. 이 설계에서는 계속 GND에 둔다.

## PC/MAR 입력 연결

```text
2번 1A ← 하위 PC 14번 PC0
3번 1B ← MAR 2번 Q0
4번 1Y → ADDRESS A0

5번 2A ← 하위 PC 13번 PC1
6번 2B ← MAR 5번 Q1
7번 2Y → ADDRESS A1

11번 3A ← 하위 PC 12번 PC2
10번 3B ← MAR 6번 Q2
9번  3Y → ADDRESS A2

14번 4A ← 하위 PC 11번 PC3
13번 4B ← MAR 9번 Q3
12번 4Y → ADDRESS A3
```

1번 `S`는 Select 제어선이다.

---

# 2-5. 74HC157 주소 선택 MUX 상위칩

상위 MUX는 A4~A7을 만든다.

## 기본 연결

```text
8번 GND → GND
15번 /G → GND
16번 VCC → +5V
```

## PC/MAR 입력 연결

```text
2번 1A ← 상위 PC 14번 PC4
3번 1B ← MAR 12번 Q4
4번 1Y → ADDRESS A4

5번 2A ← 상위 PC 13번 PC5
6번 2B ← MAR 15번 Q5
7번 2Y → ADDRESS A5

11번 3A ← 상위 PC 12번 PC6
10번 3B ← MAR 16번 Q6
9번  3Y → ADDRESS A6

14번 4A ← 상위 PC 11번 PC7
13번 4B ← MAR 19번 Q7
12번 4Y → ADDRESS A7
```

두 74HC157의 **1번 S를 서로 연결해서 하나의 Select 선**으로 사용한다.

두 칩 모두 16번 VCC와 8번 GND 사이에 0.1µF를 연결한다.

---

# 2-6. PC / MAR 선택 MUX 테스트

이 테스트는 PC와 MAR에 **서로 다른 값**을 만들어야 확인하기 쉽다.

예:

```text
PC  = 00000011
MAR = 10100101
```

## PC 선택 테스트

두 74HC157의 1번 S를 GND에 연결한다.

```text
S = LOW
```

ADDRESS A7~A0이:

```text
00000011
```

이면 정상이다.

## MAR 선택 테스트

두 74HC157의 1번 S를 +5V에 연결한다.

```text
S = HIGH
```

ADDRESS A7~A0이:

```text
10100101
```

이면 정상이다.

### MUX 출력 핀 다시 확인

```text
하위 74HC157
4번  = A0
7번  = A1
9번  = A2
12번 = A3

상위 74HC157
4번  = A4
7번  = A5
9번  = A6
12번 = A7
```

---

# 2-7. 74HC138 RAM 뱅크 디코더

RAM은 32바이트짜리 칩 5개를 사용한다.
그래서 ADDRESS의 상위 비트 `A7 A6 A5`를 보고 어느 RAM을 선택할지 결정한다.

74HC138 출력은 **Active-Low**다.
즉 선택된 출력만 `LOW`가 된다.

## 전원과 Enable

```text
4번 /G2A → GND
5번 /G2B → GND
6번 G1   → +5V
8번 GND  → GND
16번 VCC → +5V
```

## 주소 입력

```text
1번 A ← ADDRESS A5 = 상위 74HC157 7번
2번 B ← ADDRESS A6 = 상위 74HC157 9번
3번 C ← ADDRESS A7 = 상위 74HC157 12번
```

## 출력

```text
15번 Y0 → RAM #1 CS
14번 Y1 → RAM #2 CS
13번 Y2 → RAM #3 CS
12번 Y3 → RAM #4 CS
11번 Y4 → RAM #5 CS
10번 Y5 → 현재는 테스트/후속 제어용
9번  Y6 → 현재는 테스트/후속 제어용
7번  Y7 → 현재는 테스트/후속 제어용
```

16번과 8번 사이에 0.1µF를 연결한다.

---

# 2-8. RAM 뱅크 선택 테스트

테스트할 때는 MUX가 MAR를 선택하도록 한다.

```text
두 74HC157의 1번 S → +5V
```

MAR 값을 바꾸며 74HC138 출력이 다음처럼 되는지 확인한다.

| MAR 주소 | A7 A6 A5 | LOW가 되어야 하는 출력 | 선택 RAM |
|---:|:---:|:---:|---|
| 0 | 000 | 15번 Y0 | RAM #1 |
| 32 | 001 | 14번 Y1 | RAM #2 |
| 64 | 010 | 13번 Y2 | RAM #3 |
| 96 | 011 | 12번 Y3 | RAM #4 |
| 128 | 100 | 11번 Y4 | RAM #5 |

멀티미터로 보면 선택된 출력은 약 `0V`, 나머지는 약 `5V`가 나와야 한다.

LED로 Active-Low 출력을 확인하려면 다음처럼 연결한다.

```text
+5V → 1kΩ → LED → 74HC138 Y 출력
```

이 연결에서는 **선택된 출력이 LOW일 때 LED가 켜진다.**

한 순간에 RAM #1~#5 중 두 개 이상이 동시에 선택되는 것처럼 보이면 다음 단계로 가지 않는다.

---

# 2단계 완료 체크

- [ ] 하위 PC가 0~15를 정상 카운트
- [ ] 15→16에서 상위 PC가 정상 증가
- [ ] PC Reset 정상
- [ ] MAR가 8비트 값을 저장하고 유지
- [ ] MUX S=LOW에서 PC 주소 출력
- [ ] MUX S=HIGH에서 MAR 주소 출력
- [ ] 주소 0/32/64/96/128에서 RAM #1~#5가 각각 선택

모두 정상이라면 RAM을 연결한다.

## 다음 단계

[03_RAM과_DATA_BUS.md](./03_RAM과_DATA_BUS.md)