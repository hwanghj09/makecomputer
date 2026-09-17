# MAKECOMPUTER/8 단계별 만들기

이 폴더는 `컴퓨터만들기.md`의 최종 배선표를 **실제로 처음부터 만드는 순서**로 다시 설명한 초보자용 제작 설명서다.

## 가장 중요한 원칙

이 폴더에서는 **아직 만들지 않은 부품이나 신호를 미리 연결하지 않는다.**

예를 들어 1단계에서 `DB`, `PC`, `MAR`, `U28` 같은 것이 아직 나오지 않았다면:

- 그 용어를 몰라도 된다.
- 그 선을 연결하지 않는다.
- 나중 단계에서 처음 만들 때 뜻부터 설명한다.

각 단계는 아래 순서를 따른다.

```text
새로운 용어 설명
   ↓
이번에 필요한 부품만 꽂기
   ↓
전원 연결
   ↓
핀 한 줄씩 배선
   ↓
그 부품만 단독 테스트
   ↓
정상 확인
   ↓
이미 만든 앞 단계와 연결
   ↓
다음 단계
```

즉 `최종 배선표를 한꺼번에 꽂는 방식`이 아니라 **진짜 제작 순서**로 진행한다.

---

## 사용하는 방법

1. 반드시 번호 순서대로 연다.
2. 문서에 처음 나오는 단어는 바로 위 설명부터 읽는다.
3. `지금은 연결하지 않는다`라고 적힌 핀은 그대로 둔다.
4. 테스트용 HIGH/LOW 점퍼는 그 단계 테스트가 끝날 때까지만 사용한다.
5. 테스트를 통과한 다음 단계에서 최종 연결로 바꾼다.
6. 한 단계가 실패하면 다음 단계로 가지 않는다.

---

## 공통 안전 규칙

- 배선 변경은 전원을 끄고 한다.
- 모든 논리 IC 전원은 +5V다.
- 모든 GND는 서로 연결한다.
- 각 IC VCC-GND 바로 옆에 0.1µF 디커플링 커패시터를 단다.
- LED 테스트는 330Ω~1kΩ 직렬 저항을 사용한다.
- 사용하지 않는 CMOS 입력은 floating 상태로 두지 않는다.
- 칩이 뜨거워지면 즉시 전원을 끈다.

---

## 점퍼선 색 규칙

| 색 | 역할 |
|---|---|
| 🟥 빨강 | POWER +5V |
| ⬛ 검정 | GND |
| 🟩 초록 | DATA |
| 🟨 노랑 | ADDRESS |
| 🟦 파랑 | CLOCK / RESET |
| 🟧 주황 | CONTROL |
| ⬜ 흰색 | STATUS / FLAG / SPECIAL |

처음에는 색 이름을 전부 외울 필요 없다. 각 파일에서 **왜 그 색인지 같이 설명한다.**

---

## 제작 순서

| 파일 | 이번 파일에서 처음 만드는 것 |
|---|---|
| [01_전원과_클럭.md](./01_전원과_클럭.md) | +5V/GND, NE555 Clock |
| [02_PC_MAR_Address.md](./02_PC_MAR_Address.md) | PC, MAR, Address Bus, RAM Bank Decoder |
| [03_RAM과_DATA_BUS.md](./03_RAM과_DATA_BUS.md) | RAM, RAM_D, DB0~DB7, Manual Input |
| [04_A_Register_ALU.md](./04_A_Register_ALU.md) | A Register, ADD/SUB ALU |
| [05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md) | IR, 명령 Decoder, Microstep, OUT |
| [06_Control_Logic.md](./06_Control_Logic.md) | 자동 Control Logic U28~U49 |
| [07_Flag_BootROM.md](./07_Flag_BootROM.md) | Z Flag, Monitor Mode, Boot ROM |
| [08_IO_LCD.md](./08_IO_LCD.md) | Memory-Mapped I/O, LCD |
| [09_PS2_Keyboard.md](./09_PS2_Keyboard.md) | PS/2 Keyboard |
| [10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md) | 전체 통합 |

---

## 1~3단계에서 특히 달라진 점

초기 설명서에는 최종 배선 대상인 `U28`, `U33`, `U49` 같은 **아직 만들지 않은 IC 이름이 너무 일찍 등장**했다.

현재는 이렇게 수정했다.

### 1단계

```text
전원 → NE555 → LED 깜빡임
```

만 한다. `DB`, `PC`, `U28`을 몰라도 된다.

### 2단계

```text
NE555 → PC → MAR → Address MUX → U26
```

순서로 하나씩 만든다.

최종 제어회로가 아직 없기 때문에 `/LOAD`, Select 같은 제어 입력은 **테스트용 +5V/GND 점퍼**로 직접 넣는다.

### 3단계

처음으로 `DATA`와 `DATA BUS(DB0~DB7)`의 뜻을 설명한 뒤 RAM을 연결한다.

RAM의 MRD/MWR도 U33/U49에 바로 연결하지 않고, 먼저 수동 HIGH/LOW로 Read/Write를 성공시킨다.

---

## 현재 제작 위치

이미 실제로 만든 회로가 있다면 그 부분을 뜯을 필요는 없다.

현재까지 정상 동작한 Clock, PC, MAR, Address MUX는 그대로 두고 해당 문서의 **테스트 항목만 다시 확인**하면 된다.

그 다음 U26 RAM Bank Decoder부터 이어서 진행하면 된다.

---

`컴퓨터만들기.md`는 최종 전체 연결을 확인하는 **최종 배선 참고서**이고,
`단계별 만들기/`는 실제 제작할 때 보는 **작업 순서 설명서**다.
