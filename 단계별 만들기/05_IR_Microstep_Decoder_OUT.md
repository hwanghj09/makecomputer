# 5단계 — IR, Microstep, OUT, 기본 명령 구분

4단계까지 CPU는:

- 값을 저장할 수 있고
- RAM을 읽고 쓸 수 있고
- 더하고 뺄 수 있고
- 결과를 DATA BUS에 내보낼 수 있다.

하지만 아직 **무슨 명령어를 실행 중인지**와 **몇 번째 순서인지**를 모른다.

이번 단계에서 그 두 가지를 만든다.

---

# 1. 이번 단계에서 처음 배우는 말

## Instruction
CPU에게 시키는 명령이다.

예:

```text
LDA = 메모리 값을 A에 읽기
STA = A 값을 메모리에 저장
ADD = 더하기
SUB = 빼기
OUT = 출력
JMP = 다른 주소로 이동
HLT = 정지
```

## IR
IR은 **Instruction Register**다.

현재 실행할 명령어 8bit를 기억한다.

## Opcode
명령어 종류를 나타내는 비트 패턴이다.

예:

```text
00100000 = LDA
01000000 = STA
01100000 = ADD
```

## Decoder
비트 패턴을 보고 `LDA인지 ADD인지` 구분하는 칩이다.

## Microstep
명령어 하나도 한 순간에 끝나지 않는다.

작은 단계로 나눈다.

```text
T0 → T1 → T2 → T3 → T4 → T5 → T0
```

## OUT Register
A 값을 LCD나 LED 같은 외부 출력용으로 한 번 저장해 두는 Register다.

---

# 2. U15 IR부터 만든다

U15는 74HC273이다.

## 전원/Reset

- U15-20 → +5V — 🟥
- U15-10 → GND — ⬛
- U15-1 → RESET_N — 🟦
- U15-20 ↔ U15-10 사이 0.1µF

## DATA BUS 입력

```text
DB0 → U15-3
DB1 → U15-4
DB2 → U15-7
DB3 → U15-8
DB4 → U15-13
DB5 → U15-14
DB6 → U15-17
DB7 → U15-18
```

모두 🟩 초록이다.

## IR 저장 Clock
아직 자동회로가 없으므로 U15-11에 테스트용 버튼 Clock을 단다.

```text
U15-11 ── 10kΩ ── GND
U15-11 ── 버튼 ── +5V
```

## IR 출력 이름

```text
IR0 = U15-2
IR1 = U15-5
IR2 = U15-6
IR3 = U15-9
IR4 = U15-12
IR5 = U15-15
IR6 = U15-16
IR7 = U15-19
```

IR 출력은 데이터라기보다 **명령어를 구분하는 제어정보**로 사용하므로 이후 주황선을 사용한다.

## 테스트

1. U20으로 DATA BUS에 `00100000`
2. U15 Clock 버튼 1번
3. IR7~IR0가 `00100000`인지 확인
4. DATA BUS를 다른 값으로 바꿔도 Clock을 누르기 전까지 IR은 그대로여야 함

---

# 3. 기본 Opcode가 어떻게 나뉘는지 먼저 이해

기본 명령은 IR7~IR5 세 비트로 구분한다.

```text
IR7 IR6 IR5
001 → LDA
010 → STA
011 → ADD
100 → SUB
101 → OUT
110 → JMP
111 → HLT
000 → 확장 명령 그룹
```

U27 74HC139를 사용해 이 패턴을 나눈다.

다만 U27의 두 번째 절반은 `IR7의 반대값`이 필요하다.

그 반대값은 다음 Control Logic 단계에서 U46 인버터를 만든 뒤 연결한다.

따라서 **이번 단계에서는 U27의 첫 번째 절반만 실제로 시험한다.**

---

# 4. U27 첫 번째 절반 연결

U27은 74HC139이다.

## 전원

- U27-16 → +5V — 🟥
- U27-8 → GND — ⬛
- 0.1µF 연결

## 첫 번째 Decoder

```text
U27-1  ← IR7 = U15-19
U27-2  ← IR5 = U15-15
U27-3  ← IR6 = U15-16
```

출력:

```text
U27-4 = EXT_GROUP_N
U27-5 = LDA_N
U27-6 = STA_N
U27-7 = ADD_N
```

`_N`은 선택되었을 때 LOW라는 뜻이다.

## 테스트 LED
Active-Low 출력이므로:

```text
+5V → 1kΩ → LED → 출력핀
```

으로 본다.

IR에:

```text
00000000 → U27-4 선택
00100000 → U27-5 선택
01000000 → U27-6 선택
01100000 → U27-7 선택
```

이 되는지 확인한다.

## 지금은 연결하지 않는 U27 핀

```text
U27-9,10,11,12
U27-13,14,15
```

이 두 번째 Decoder 부분은 다음 파일에서 필요한 반전 신호를 만든 뒤 연결한다.

---

# 5. Microstep Counter U4를 만든다

CPU가 명령어를 순서대로 처리하려면 지금 T0인지 T1인지 세어야 한다.

U4는 74HC161이다.

처음에는 T0~T7까지 그냥 세는지부터 시험한다.

## U4 전원

- U4-16 → +5V — 🟥
- U4-8 → GND — ⬛
- U4-1 → RESET_N — 🟦
- U4-16 ↔ U4-8 사이 0.1µF

## U4 테스트 연결

- U4-2 → U1-3 Clock — 🟦
- U4-7 → +5V
- U4-10 → +5V
- U4-9 → +5V, 처음에는 Load 비활성
- U4-3,4,5,6 → GND

출력:

```text
U4-14 = step bit0
U4-13 = step bit1
U4-12 = step bit2
```

U4-11은 이번 설계에서 사용하지 않는다.

## 테스트
Clock마다:

```text
000
001
010
011
100
101
110
111
000
```

이 반복되는지 본다.

---

# 6. U25로 숫자를 T0,T1...로 바꾼다

U25는 74HC138이다.

U4의 3bit 숫자를 8개의 출력 중 하나로 바꾼다.

## U25 연결

- U25-16 → +5V — 🟥
- U25-8 → GND — ⬛
- U25-4 → GND
- U25-5 → GND
- U25-6 → +5V
- U25-1 ← U4-14
- U25-2 ← U4-13
- U25-3 ← U4-12
- 0.1µF 연결

출력은 Active-Low다.

```text
U25-15 = T0_N
U25-14 = T1_N
U25-13 = T2_N
U25-12 = T3_N
U25-11 = T4_N
U25-10 = T5_N
U25-9  = T6_N
U25-7  = T7_N
```

## 테스트
Active-Low LED를 Y0~Y7에 달아 Clock을 천천히 준다.

```text
T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7
```

순서인지 본다.

---

# 7. T5 뒤에 바로 T0로 돌아가게 한다

우리 CPU는 T0~T5만 사용한다.

그래서 T5에서 U4의 /LOAD를 LOW로 만들어 다음 Clock에 000을 로드한다.

U4-3,4,5,6은 이미 GND라 병렬 Load값은 0000이다.

기존 U4-9의 +5V 임시선을 제거하고:

```text
U25-10(T5_N) → U4-9(/LOAD)
```

를 연결한다.

## 다시 테스트

이제:

```text
T0 → T1 → T2 → T3 → T4 → T5 → T0
```

만 반복해야 한다.

T6/T7은 나오면 안 된다.

---

# 8. U17 OUT Register를 만든다

U17도 74HC273이다.

나중에 `OUT` 명령이나 LCD 출력 데이터를 저장한다.

아직 LCD는 연결하지 않는다.

## 전원/Reset

- U17-20 → +5V
- U17-10 → GND
- U17-1 → RESET_N
- 0.1µF

## DATA BUS 입력

```text
DB0 → U17-3
DB1 → U17-4
DB2 → U17-7
DB3 → U17-8
DB4 → U17-13
DB5 → U17-14
DB6 → U17-17
DB7 → U17-18
```

## 테스트용 Clock
U17-11에 버튼 Clock을 단다.

## 출력

```text
U17-2  = OUT0
U17-5  = OUT1
U17-6  = OUT2
U17-9  = OUT3
U17-12 = OUT4
U17-15 = OUT5
U17-16 = OUT6
U17-19 = OUT7
```

LED+저항으로 시험한다.

## 테스트

1. DATA BUS=`01000001`
2. U17 Clock 1회
3. OUT=`01000001`
4. DATA BUS를 바꿔도 Clock 전까지 OUT 유지

---

# 9. 이번 단계가 끝났을 때

이제 CPU에는:

```text
IR = 현재 명령어 기억
U27 첫 절반 = EXT/LDA/STA/ADD 구분
U4/U25 = T0~T5 순서 생성
OUT = 출력값 저장
```

이 생겼다.

하지만 아직 다음은 사람이 버튼/점퍼로 한다.

```text
IR 저장 Clock
A 저장 Clock
MAR 저장 Clock
OUT 저장 Clock
RAM Read/Write
PC Count/Load
ALU Select
```

다음 단계에서 AND/OR/NOT 게이트를 사용해 이 작업을 **자동으로 만드는 Control Logic**을 시작한다.

---

# 완료 체크

- [ ] U15가 DATA BUS 명령값 저장
- [ ] U27 첫 절반에서 EXT/LDA/STA/ADD 구분
- [ ] U4가 3bit 순서대로 카운트
- [ ] U25가 T0~T7 순서로 디코드
- [ ] U25-10→U4-9 연결 후 T0~T5만 반복
- [ ] U17이 DATA BUS 값 저장/유지
- [ ] 모든 새 IC에 0.1µF

[06_Control_Logic.md](./06_Control_Logic.md)
