# 8단계 — Memory-Mapped I/O와 20×4 LCD

이번 단계에서는 주소 `160~163`을 키보드/LCD용 I/O 주소로 사용하고, 20×4 LCD를 연결한다.

주소 배치는 다음과 같다.

```text
160 = KEY_STATUS
161 = KEY_DATA
162 = LCD_DATA
163 = LCD_COMMAND
```

즉 CPU는 키보드와 LCD도 메모리처럼 주소로 접근한다.

예:

```text
LDA 161 → 키보드 데이터 읽기
STA 162 → LCD 문자 데이터 쓰기
STA 163 → LCD 명령 쓰기
```

---

# 8-1. Memory-Mapped I/O가 무엇인가

CPU 입장에서 RAM과 I/O 장치를 다른 명령으로 구분하지 않고 **주소로 구분**하는 방식이다.

```text
0~159   → RAM
160~163 → I/O
```

현재 ADDRESS BUS의 `A0~A7`은 그대로 사용한다.

---

# 8-2. 74HC138 I/O 주소 디코더

이 74HC138이 주소 `160, 161, 162, 163`을 구분한다.

출력은 Active-Low다.

```text
선택된 Y 출력 = LOW
선택되지 않은 Y 출력 = HIGH
```

## 전원

```text
8번 GND → GND
16번 VCC → +5V
```

16번과 8번 사이에 0.1µF를 연결한다.

## 주소 입력

```text
1번 A ← ADDRESS A0 = 주소 선택 74HC157 하위칩 4번
2번 B ← ADDRESS A1 = 주소 선택 74HC157 하위칩 7번
3번 C ← ADDRESS A2 = 주소 선택 74HC157 하위칩 9번
```

## Enable 조건

```text
4번 /G2A ← RAM 뱅크 74HC138 10번 Y5
5번 /G2B ← ADDRESS A4 = 주소 선택 74HC157 상위칩 4번
6번 G1   ← A3_N
```

`A3_N`은 6단계 74HC04에서 만들어진다.

## 출력

```text
15번 Y0 = KEY_STATUS_N
14번 Y1 = KEY_DATA_N
13번 Y2 = LCD_DATA_N
12번 Y3 = LCD_COMMAND_N
11번 Y4 = 주소 164 예약
10번 Y5 = 예약
9번  Y6 = 예약
7번  Y7 = 예약
```

연결 대상:

```text
15번 KEY_STATUS_N → 74HC08 Keyboard·LCD·ACK 1번
14번 KEY_DATA_N   → 같은 74HC08 2번
                   → 74HC32 Boot·Keyboard·LCD BUS 10번
13번 LCD_DATA_N   → 74HC08 Keyboard·LCD·ACK 12번
12번 LCD_COMMAND_N→ 같은 74HC08 13번
                   → LCD 4번 RS
```

---

# 8-3. I/O 주소 디코더 테스트

ADDRESS를 다음 값으로 바꾸며 확인한다.

```text
160 = 10100000 → 15번 Y0만 LOW
161 = 10100001 → 14번 Y1만 LOW
162 = 10100010 → 13번 Y2만 LOW
163 = 10100011 → 12번 Y3만 LOW
```

멀티미터로 보면:

```text
선택 출력 ≈ 0V
나머지 출력 ≈ 5V
```

Active-Low LED로 확인하려면:

```text
+5V → 1kΩ → LED → Y 출력
```

으로 연결한다.

---

# 8-4. LCD 16핀 역할

HD44780 호환 20×4 LCD 기준:

```text
1번  VSS = GND
2번  VDD = +5V
3번  VO  = 화면 대비
4번  RS  = Data / Command 선택
5번  R/W = Read / Write 선택
6번  E   = Enable pulse
7번  D0
8번  D1
9번  D2
10번 D3
11번 D4
12번 D5
13번 D6
14번 D7
15번 LED+ = 백라이트 +
16번 LED- = 백라이트 GND
```

이 컴퓨터는 LCD에서 데이터를 읽지 않고 쓰기만 한다.

따라서:

```text
LCD 5번 R/W → GND
```

로 고정한다.

---

# 8-5. LCD 전원과 대비만 먼저 시험

처음에는 DATA선과 RS/E를 연결하지 않고 **전원과 화면 대비만** 확인한다.

## 연결

```text
LCD 1번 VSS → GND
LCD 2번 VDD → +5V
LCD 5번 R/W → GND
LCD 16번 LED- → GND
```

백라이트는 사용 중인 LCD 모듈 사양에 맞게:

```text
LCD 15번 LED+ → +5V
```

에 연결한다.

모듈에 백라이트 저항이 내장되어 있는지 확인한다.

## 10kΩ 가변저항으로 VO 만들기

```text
가변저항 한쪽 끝 → +5V
가변저항 반대쪽 끝 → GND
가변저항 가운데 핀 → LCD 3번 VO
```

전원을 켜고 천천히 돌린다.

LCD가 아직 초기화되지 않았다면 검은 블록이 보일 수 있다.
그 자체는 전원/대비가 동작하고 있다는 의미일 수 있다.

---

# 8-6. OUT 레지스터 → LCD D0~D7

LCD에 실제 8비트 값을 보내는 장치는 74HC273 OUT 레지스터다.

연결:

```text
OUT 2번  Q0 → LCD 7번 D0
OUT 5번  Q1 → LCD 8번 D1
OUT 6번  Q2 → LCD 9번 D2
OUT 9번  Q3 → LCD 10번 D3
OUT 12번 Q4 → LCD 11번 D4
OUT 15번 Q5 → LCD 12번 D5
OUT 16번 Q6 → LCD 13번 D6
OUT 19번 Q7 → LCD 14번 D7
```

D0와 D7 방향을 바꾸지 않도록 주의한다.

---

# 8-7. LCD RS 연결

```text
LCD 4번 RS ← I/O 주소 74HC138 12번 LCD_COMMAND_N
```

현재 설계에서는 이 주소 판정 신호를 이용해 Data/Command를 구분한다.

주소 기준:

```text
162 → LCD_DATA
163 → LCD_COMMAND
```

---

# 8-8. LCD E 연결

LCD는 D0~D7 값이 연결되어 있기만 해서는 데이터를 받아들이지 않는다.

`E`에 pulse가 들어올 때 현재 데이터와 RS 상태를 받아들인다.

연결:

```text
LCD 6번 E ← 74HC08 OUT·LCD·PS2 제어 칩 8번 LCD_E
```

즉 자동 동작에서는 6단계 제어회로가 E pulse를 만든다.

---

# 8-9. LCD 전체 연결 한눈에 보기

```text
1번  VSS → GND
2번  VDD → +5V
3번  VO  → 10kΩ 가변저항 가운데
4번  RS  ← I/O 주소 74HC138 12번
5번  R/W → GND
6번  E   ← 74HC08 OUT·LCD·PS2 8번
7번  D0  ← OUT 2번 Q0
8번  D1  ← OUT 5번 Q1
9번  D2  ← OUT 6번 Q2
10번 D3  ← OUT 9번 Q3
11번 D4  ← OUT 12번 Q4
12번 D5  ← OUT 15번 Q5
13번 D6  ← OUT 16번 Q6
14번 D7  ← OUT 19번 Q7
15번 LED+ → 모듈 사양에 맞게 +5V
16번 LED- → GND
```

---

# 8-10. LCD 초기화가 필요한 이유

LCD는 전원을 넣자마자 일반 문자를 바로 받는다고 가정하면 안 된다.

먼저 Monitor 프로그램에서 초기화 명령을 보내야 한다.

필요한 기본 과정:

```text
8비트 모드 설정
Display ON
Entry Mode 설정
Clear Display
```

정확한 초기화 명령 바이트와 지연시간은 사용하는 LCD의 HD44780 호환 규격에 맞춰 Monitor ROM 프로그램에서 처리한다.

---

# 8-11. 문자 A 출력 테스트

ASCII 문자 `A`는:

```text
0x41
= 01000001
```

이다.

## 테스트 순서

1. LCD 초기화가 끝난 상태로 만든다.
2. OUT 레지스터에 `01000001`을 저장한다.
3. ADDRESS를 `162`의 LCD_DATA 조건으로 만든다.
4. LCD 6번 E에 정상 pulse가 들어가는지 확인한다.
5. 화면에 `A`가 나타나는지 확인한다.

---

# LCD가 안 될 때

## 화면에 아무것도 안 보임

먼저 측정:

```text
LCD 2번 VDD ↔ LCD 1번 VSS ≈ 5V
```

그다음 3번 VO 가변저항을 확인한다.

## 검은 블록만 보임

전원/대비는 동작하지만 초기화 명령 또는 E pulse에 문제가 있을 가능성이 있다.

확인:

```text
LCD 5번 R/W = GND인지
LCD 6번 E가 움직이는지
LCD 4번 RS 조건이 맞는지
```

## 이상한 문자가 나옴

D0~D7 순서를 다시 확인한다.

```text
OUT Q0 → LCD D0
...
OUT Q7 → LCD D7
```

---

# 8단계 완료 체크

- [ ] 주소 160에서 KEY_STATUS_N 선택
- [ ] 주소 161에서 KEY_DATA_N 선택
- [ ] 주소 162에서 LCD_DATA_N 선택
- [ ] 주소 163에서 LCD_COMMAND_N 선택
- [ ] LCD 1번/2번 전원 정상
- [ ] LCD 3번 대비 조절 정상
- [ ] LCD 5번 R/W가 GND
- [ ] OUT Q0~Q7 → LCD D0~D7 순서 정상
- [ ] LCD 4번 RS 정상
- [ ] LCD 6번 E pulse 정상
- [ ] 초기화 후 문자 A 출력 성공

## 다음 단계

[09_PS2_Keyboard.md](./09_PS2_Keyboard.md)