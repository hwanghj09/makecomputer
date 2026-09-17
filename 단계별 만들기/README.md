# MAKECOMPUTER/8 단계별 만들기

이 폴더는 `컴퓨터만들기.md`의 최종 배선표를 **처음 만드는 사람도 그대로 따라갈 수 있는 실제 제작 순서**로 다시 설명한 설명서다.

## 이 폴더에서 지키는 가장 중요한 규칙

### 1. 아직 안 만든 것은 나오지 않는다
예를 들어 1단계에서는 `DB0`, `MAR`, `U28`, `PC_COUNT` 같은 말을 사용하지 않는다.

어떤 용어가 처음 필요해지는 순간에 바로 뜻을 설명한 뒤 사용한다.

### 2. 최종 배선보다 먼저 단독 테스트를 한다
처음부터 모든 핀을 최종 제어회로에 연결하지 않는다.

```text
부품 하나 꽂기
↓
전원 연결
↓
테스트용 +5V/GND/Clock으로 단독 동작 확인
↓
정상 확인
↓
이미 만든 앞 단계와 연결
↓
나중 단계에서 자동 제어선으로 교체
```

### 3. `지금 연결`과 `나중 연결`을 구분한다
각 파일에는 다음 표시를 사용한다.

- **지금 연결**: 현재 단계에서 실제로 꽂는다.
- **테스트용 임시 연결**: 현재 단계 시험을 위해 잠깐 +5V/GND/Clock에 연결한다.
- **지금은 연결하지 않음**: 아직 상대 부품을 만들지 않았으므로 그대로 둔다.
- **교체**: 이전 단계의 임시선을 빼고 최종선을 꽂는다.

### 4. 한 단계가 성공해야 다음 단계로 간다
문제가 생기면 전체를 뜯지 않는다. 마지막으로 추가한 부품만 다시 확인한다.

---

# 가장 먼저 알아야 하는 것

## IC 핀 번호 보는 법
IC의 홈(노치)을 위로 놓는다.

```text
        홈
      ┌─────┐
  1  ─│     │─ 14 또는 16/20
  2  ─│     │─ ...
  3  ─│     │─ ...
      └─────┘
```

왼쪽 위가 1번이고, 왼쪽으로 내려간 뒤 오른쪽 아래에서 다시 위로 올라간다.

## HIGH / LOW
- **HIGH**: 약 +5V
- **LOW**: 약 0V = GND

## Active-Low
핀 이름 앞에 `/`가 있거나 이름 끝에 `_N`이 붙으면 보통 **LOW일 때 동작**한다.

예:
- `/OE = LOW` → 출력 허용
- `/CLR = LOW` → 초기화

## 사용하지 않는 CMOS 입력
74HC 입력핀은 공중에 떠 있게 두면 안 된다. 문서에서 사용하지 않는 입력은 +5V 또는 GND에 고정한다.

---

# 점퍼선 색 규칙

| 색 | 역할 |
|---|---|
| 🟥 빨강 | POWER +5V |
| ⬛ 검정 | GND |
| 🟩 초록 | DATA |
| 🟨 노랑 | ADDRESS |
| 🟦 파랑 | CLOCK / RESET |
| 🟧 주황 | CONTROL |
| ⬜ 흰색 | STATUS / FLAG / SPECIAL |

처음부터 외울 필요는 없다. 각 단계에서 선의 역할과 색을 같이 설명한다.

---

# 제작 순서

| 순서 | 파일 | 이 파일에서 처음 배우는 것 |
|---:|---|---|
| 1 | [01_전원과_클럭.md](./01_전원과_클럭.md) | +5V, GND, HIGH/LOW, Clock, Reset |
| 2 | [02_PC_MAR_Address.md](./02_PC_MAR_Address.md) | PC, MAR, Address, Address MUX, RAM Bank |
| 3 | [03_RAM과_DATA_BUS.md](./03_RAM과_DATA_BUS.md) | Data, DATA BUS, RAM Read/Write |
| 4 | [04_A_Register_ALU.md](./04_A_Register_ALU.md) | A Register, ADD/SUB, ALU |
| 5 | [05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md) | IR, Opcode, Microstep, OUT |
| 6 | [06_Control_Logic.md](./06_Control_Logic.md) | AND/OR/NOT, 자동 제어 신호 |
| 7 | [07_Flag_BootROM.md](./07_Flag_BootROM.md) | Zero Flag, Monitor Mode, Boot ROM, HALT |
| 8 | [08_IO_LCD.md](./08_IO_LCD.md) | Memory-Mapped I/O, LCD |
| 9 | [09_PS2_Keyboard.md](./09_PS2_Keyboard.md) | PS/2 Clock/Data, Scan Code, KEY_READY |
| 10 | [10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md) | 임시선 제거, 전체 통합, 프로그램 시험 |

---

# 현재 실제 제작 상태를 반영하는 방법

이미 정상 동작하는 회로는 뜯지 않는다.

현재 Clock, 8bit PC, MAR, Address MUX가 정상이라면:

1. 1단계와 2단계의 **테스트 항목만 다시 확인**한다.
2. 이상이 없으면 2단계의 RAM Bank Decoder부터 이어간다.
3. 이후에는 문서 순서를 그대로 따른다.

---

# 최종 배선표와 관계

- `컴퓨터만들기.md` = 완성된 컴퓨터의 **최종 전체 배선표**
- `단계별 만들기/` = 그 완성 상태까지 가는 **실제 작업 순서 설명서**

둘이 역할이 다르다. 실제 만들 때는 이 폴더를 먼저 보고, 마지막 검산 때 `컴퓨터만들기.md`를 본다.
