# 5단계 — IR, 명령 디코더, Microstep, OUT

이번 단계에서는 CPU가 **현재 명령어를 기억하고**, 그 명령어 종류를 구분하고, 한 명령을 `T0~T5`의 작은 단계로 나누는 회로를 만든다.

순서:

```text
74HC273 명령어 레지스터(IR)
↓
74HC139 기본 명령 디코더
↓
74HC161 마이크로스텝 카운터
↓
74HC138 마이크로스텝 디코더
↓
74HC139 확장명령 유효 디코더
↓
74HC139 확장 명령 디코더
↓
74HC273 출력 레지스터(OUT)
```

---

# 먼저 알아둘 것

## IR이란?

`Instruction Register`는 현재 실행 중인 8비트 명령어를 저장한다.

```text
IR7 IR6 IR5 ... IR0
```

## Decoder란?

IR 비트를 보고 현재 명령이 `LDA`, `STA`, `ADD` 같은 것인지 구분한다.

## Microstep이란?

한 명령을 한 Clock에 전부 처리하지 않고:

```text
T0 → T1 → T2 → T3 → T4 → T5 → T0
```

처럼 여러 단계로 나눠 처리한다.

## Active-Low 출력

74HC138/74HC139의 출력은 LOW일 때 선택되는 경우가 많다.

예:

```text
LDA_N = LOW → LDA 명령 선택됨
```

---

# 5-1. 74HC273 명령어 레지스터(IR)

## 전원과 Clock

```text
IR 1번 /CLR → RESET 선
IR 10번 GND → GND
IR 11번 CLK → 지금은 수동 IR_CLK
IR 20번 VCC → +5V
```

20번과 10번 사이에 0.1µF를 연결한다.

## DATA BUS 입력

```text
DB0 → IR 3번 D0
DB1 → IR 4번 D1
DB2 → IR 7번 D2
DB3 → IR 8번 D3
DB4 → IR 13번 D4
DB5 → IR 14번 D5
DB6 → IR 17번 D6
DB7 → IR 18번 D7
```

## IR 출력

```text
IR 2번  Q0 = IR0
IR 5번  Q1 = IR1
IR 6번  Q2 = IR2
IR 9번  Q3 = IR3
IR 12번 Q4 = IR4
IR 15번 Q5 = IR5
IR 16번 Q6 = IR6
IR 19번 Q7 = IR7
```

## 이후 디코더로 가는 연결

```text
IR 2번 IR0 → 확장 명령 디코더 2번, 14번
IR 5번 IR1 → 확장 명령 디코더 3번, 13번
IR 6번 IR2 → 6단계 제어회로
IR 9번 IR3 → 확장명령 유효 디코더 2번
IR 12번 IR4 → 확장명령 유효 디코더 3번
IR 15번 IR5 → 기본 명령 디코더 2번, 14번
IR 16번 IR6 → 기본 명령 디코더 3번, 13번
IR 19번 IR7 → 기본 명령 디코더 1번 + 6단계 제어회로
```

## IR 단독 테스트

다른 DATA BUS 출력 장치를 끄고 수동 입력 245로:

```text
00100000
```

을 DATA BUS에 만든다.

IR 11번 CLK에 상승 에지를 한 번 준다.

Q7~Q0이 `00100000`을 유지하면 정상이다.

---

# 5-2. 74HC139 기본 명령 디코더

이 칩은 `IR7 IR6 IR5`를 보고 기본 명령을 구분한다.

## 전원

```text
8번 GND → GND
16번 VCC → +5V
```

16번과 8번 사이에 0.1µF를 연결한다.

## 첫 번째 절반

```text
1번 /1G ← IR 19번 IR7
2번 1A  ← IR 15번 IR5
3번 1B  ← IR 16번 IR6

4번 /1Y0 = EXT_GROUP_N
5번 /1Y1 = LDA_N
6번 /1Y2 = STA_N
7번 /1Y3 = ADD_N
```

`4번 EXT_GROUP_N`은 다음 확장명령 유효 디코더 1번으로 간다.

## 두 번째 절반

```text
13번 2B ← IR 16번 IR6
14번 2A ← IR 15번 IR5
15번 /2G ← 최종적으로 IR7_N

12번 /2Y0 = SUB_N
11번 /2Y1 = OUT_N
10번 /2Y2 = JMP_N
9번  /2Y3 = HLT_N
```

지금은 IR7_N 자동회로가 아직 없으므로 테스트할 때 15번 `/2G`를 직접 HIGH/LOW로 바꿔 확인해도 된다.

## 기본 명령 테스트

IR에 다음 값을 저장하고 해당 출력이 LOW가 되는지 확인한다.

```text
00100000 → LDA_N
01000000 → STA_N
01100000 → ADD_N
10000000 → SUB_N
10100000 → OUT_N
11000000 → JMP_N
11100000 → HLT_N
```

Active-Low 출력에 LED를 달 경우:

```text
+5V → 1kΩ → LED → 디코더 출력
```

으로 연결하면 선택된 LOW 출력에서 LED가 켜진다.

---

# 5-3. 74HC161 마이크로스텝 카운터

이 카운터가 현재 `T0~T5` 중 어느 단계인지 센다.

## 연결

```text
1번 /CLR → RESET 선
2번 CLK ← 지금은 NE555 Clock 직접 연결
3번 A → GND
4번 B → GND
5번 C → GND
6번 D → GND
7번 ENP → +5V
8번 GND → GND
9번 /LOAD ← 마이크로스텝 디코더 10번 Y5
10번 ENT → +5V
11번 QD → 사용하지 않음
12번 QC → 마이크로스텝 디코더 3번 C
13번 QB → 마이크로스텝 디코더 2번 B
14번 QA → 마이크로스텝 디코더 1번 A
15번 RCO → 사용하지 않음
16번 VCC → +5V
```

16번과 8번 사이에 0.1µF를 연결한다.

6단계가 완성되면 2번 CLK는 직접 NE555가 아니라 `CPU_CLK`로 바꾼다.

---

# 5-4. 74HC138 마이크로스텝 디코더

카운터의 QA/QB/QC를 `T0~T5` 신호로 바꾼다.

## 입력과 Enable

```text
1번 A ← 마이크로스텝 카운터 14번 QA
2번 B ← 마이크로스텝 카운터 13번 QB
3번 C ← 마이크로스텝 카운터 12번 QC
4번 /G2A → GND
5번 /G2B → GND
6번 G1 → +5V
8번 GND → GND
16번 VCC → +5V
```

## 출력

```text
15번 Y0 = T0_N
14번 Y1 = T1_N
13번 Y2 = T2_N
12번 Y3 = T3_N
11번 Y4 = T4_N
10번 Y5 = T5_N
9번 Y6 = 사용하지 않음
7번 Y7 = 사용하지 않음
```

현재 중요한 연결:

```text
10번 Y5(T5_N) → 마이크로스텝 카운터 9번 /LOAD
```

이 연결 때문에 T5 다음에 다시 0000, 즉 T0로 돌아간다.

## Microstep 테스트

Y0~Y5를 확인하면서:

```text
T0 → T1 → T2 → T3 → T4 → T5 → T0
```

가 반복되는지 본다.

선택된 Y 출력은 LOW다.

---

# 5-5. 74HC139 확장명령 유효 디코더

이 칩의 첫 번째 절반은 `000xxxxx` 계열이 실제 확장명령 영역인지 확인한다.

## 첫 번째 절반

```text
1번 /1G ← 기본 명령 디코더 4번 EXT_GROUP_N
2번 1A ← IR 9번 IR3
3번 1B ← IR 12번 IR4
4번 /1Y0 = EXT_VALID_N → 6단계 제어회로
5번 /1Y1 → 사용하지 않음
6번 /1Y2 → 사용하지 않음
7번 /1Y3 → 사용하지 않음
```

## 전원

```text
8번 GND → GND
16번 VCC → +5V
```

## 두 번째 절반은 지금 비활성

이 절반은 9단계 PS/2 카운터 판정에서 사용한다.

지금은:

```text
13번 2B → GND
14번 2A → GND
15번 /2G → +5V
```

로 두어 비활성화한다.

---

# 5-6. 74HC139 확장 명령 디코더

이 칩은 다음 명령을 구분한다.

```text
NOP
LDI
CMP
JZ
JNZ
RUN
```

자동 Enable 제어는 6단계에서 연결한다.
지금은 테스트 때 `/1G`, `/2G`를 직접 제어한다.

## 첫 번째 절반

```text
1번 /1G → 테스트용 Enable
2번 1A ← IR 2번 IR0
3번 1B ← IR 5번 IR1

4번 /1Y0 = NOP_N
5번 /1Y1 = LDI_N
6번 /1Y2 = CMP_N
7번 /1Y3 = JZ_N
```

사용할 때 1번 `/1G`를 GND로 둔다.

## 두 번째 절반

```text
13번 2B ← IR 5번 IR1
14번 2A ← IR 2번 IR0
15번 /2G → 테스트용 Enable

12번 /2Y0 = JNZ_N
11번 /2Y1 = RUN_N
10번 /2Y2 = 예약
9번 /2Y3 = 예약
```

사용할 때 15번 `/2G`를 GND로 둔다.

## 전원

```text
8번 GND → GND
16번 VCC → +5V
```

## 확장 명령 테스트

```text
00000000 → NOP
00000001 → LDI
00000010 → CMP
00000011 → JZ
00000100 → JNZ
00000101 → RUN
```

해당 출력만 LOW가 되는지 확인한다.

---

# 5-7. 74HC273 출력 레지스터(OUT)

OUT 레지스터는 CPU의 값을 외부에 보여주기 위해 8비트를 저장한다.
나중에는 LCD 데이터에도 사용한다.

## 기본 연결

```text
1번 /CLR → RESET
10번 GND → GND
11번 CLK → 지금은 수동 OUT_CLK
20번 VCC → +5V
```

## DATA BUS 입력

```text
DB0 → OUT 3번 D0
DB1 → OUT 4번 D1
DB2 → OUT 7번 D2
DB3 → OUT 8번 D3
DB4 → OUT 13번 D4
DB5 → OUT 14번 D5
DB6 → OUT 17번 D6
DB7 → OUT 18번 D7
```

## 출력

```text
OUT 2번  Q0
OUT 5번  Q1
OUT 6번  Q2
OUT 9번  Q3
OUT 12번 Q4
OUT 15번 Q5
OUT 16번 Q6
OUT 19번 Q7
```

8단계에서 이 Q0~Q7을 LCD D0~D7에 연결한다.

## OUT 테스트

DATA BUS에:

```text
01000001
```

을 만든다.

OUT 11번 CLK에 상승 에지를 한 번 준다.

Q7~Q0이 `01000001`을 저장하고 유지하면 정상이다.

---

# 5단계 완료 체크

- [ ] IR이 DATA BUS의 8비트 값을 저장
- [ ] LDA/STA/ADD/SUB/OUT/JMP/HLT 디코딩 정상
- [ ] Microstep이 T0→T5→T0 반복
- [ ] NOP/LDI/CMP/JZ/JNZ/RUN 디코딩 정상
- [ ] OUT 레지스터가 DATA BUS 값을 저장하고 유지

이 단계까지는 일부 제어선을 수동으로 시험한다.
다음 단계에서 이 신호들을 자동으로 만들어 준다.

## 다음 단계

[06_Control_Logic.md](./06_Control_Logic.md)