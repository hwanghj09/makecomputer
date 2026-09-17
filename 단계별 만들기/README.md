# MAKECOMPUTER/8 단계별 만들기

이 폴더는 `컴퓨터만들기.md`의 최종 배선표를 **처음 만드는 사람도 그대로 따라갈 수 있는 실제 제작 순서**로 다시 설명한 설명서다.

## 가장 중요한 이름 규칙

이 폴더에서는 칩 번호 별칭을 쓰지 않는다.

항상 **부품명 + 역할 + 실제 핀 번호**로 쓴다.

예:

```text
74HC161 PC 하위 4비트 카운터 14번 핀(QA)
→ 74HC157 주소 선택 MUX 하위칩 2번 핀(1A)
```

같은 종류의 칩이 여러 개 있어도 역할 이름으로 구분한다.

- 74HC161 PC 하위 4비트 카운터
- 74HC161 PC 상위 4비트 카운터
- 74HC161 마이크로스텝 카운터
- 74HC161 PS/2 비트 카운터

## 제작 원칙

### 1. 아직 안 만든 것은 먼저 연결하지 않는다
어떤 용어나 부품이 처음 필요해지는 순간에 뜻부터 설명한다.

### 2. 최종 배선보다 먼저 단독 테스트한다

```text
부품 하나 꽂기
↓
전원 연결
↓
테스트용 +5V/GND/Clock으로 단독 동작 확인
↓
정상 확인
↓
앞에서 만든 회로와 연결
↓
나중 단계에서 자동 제어선으로 교체
```

### 3. 한 단계가 성공해야 다음 단계로 간다
문제가 생기면 전체를 뜯지 않고 마지막으로 추가한 부분부터 확인한다.

---

# 가장 먼저 알아야 하는 것

## IC 핀 번호 보는 법
IC 홈(노치)을 위로 둔다.

```text
        홈
      ┌─────┐
  1  ─│     │─ 마지막 핀
  2  ─│     │─ ...
  3  ─│     │─ ...
      └─────┘
```

왼쪽 위가 1번이고, 왼쪽으로 내려간 뒤 오른쪽 아래에서 다시 위로 올라간다.

## HIGH / LOW
- HIGH = 약 +5V
- LOW = 약 0V = GND

## Active-Low
핀 이름 앞에 `/`가 있거나 이름 끝에 `_N`이 붙으면 보통 LOW일 때 동작한다.

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

---

# 제작 순서

| 순서 | 파일 | 이 파일에서 처음 배우는 것 |
|---:|---|---|
| 1 | [01_전원과_클럭.md](./01_전원과_클럭.md) | +5V, GND, Clock |
| 2 | [02_PC_MAR_Address.md](./02_PC_MAR_Address.md) | Program Counter, 메모리 주소 레지스터, 주소 선택기, RAM 뱅크 |
| 3 | [03_RAM과_DATA_BUS.md](./03_RAM과_DATA_BUS.md) | DATA, 데이터 버스, RAM Read/Write |
| 4 | [04_A_Register_ALU.md](./04_A_Register_ALU.md) | A 레지스터, ADD/SUB, ALU |
| 5 | [05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md) | 명령어 레지스터, Opcode, Microstep, 출력 레지스터 |
| 6 | [06_Control_Logic.md](./06_Control_Logic.md) | AND/OR/NOT, 자동 제어 신호 |
| 7 | [07_Flag_BootROM.md](./07_Flag_BootROM.md) | Zero Flag, Monitor Mode, Boot ROM, HALT |
| 8 | [08_IO_LCD.md](./08_IO_LCD.md) | Memory-Mapped I/O, LCD |
| 9 | [09_PS2_Keyboard.md](./09_PS2_Keyboard.md) | PS/2 Clock/Data, Scan Code, KEY_READY |
| 10 | [10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md) | 임시선 제거, 전체 통합, 프로그램 시험 |

이미 정상 동작하는 Clock, 8비트 Program Counter, 메모리 주소 레지스터, 주소 선택기는 뜯지 않고 해당 단계의 테스트만 다시 확인하면 된다.

`컴퓨터만들기.md`는 완성 상태의 최종 배선표이고, 이 폴더는 실제 만드는 순서 설명서다.
