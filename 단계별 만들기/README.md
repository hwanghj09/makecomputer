# MAKECOMPUTER/8 단계별 만들기

`컴퓨터만들기.md`는 최종 배선표이고, 이 폴더는 그 내용을 **초보자가 실제로 하나씩 만들고 바로 테스트할 수 있도록** 다시 나눈 설명서다.

## 사용 방법

1. 아래 파일을 번호 순서대로 연다.
2. 한 번에 한 모듈만 배선한다.
3. 각 IC의 핀 번호와 점퍼선 색을 확인하면서 한 줄씩 연결한다.
4. 문서의 테스트를 통과한 뒤에만 다음 단계로 넘어간다.
5. 문제가 생기면 전체를 뜯지 말고 마지막으로 추가한 모듈만 다시 확인한다.

## 공통 규칙

- 전원을 끈 상태에서 배선
- 모든 논리 IC는 +5V
- 모든 GND 공통
- IC마다 0.1µF 디커플링
- LED 테스트는 330Ω~1kΩ 직렬 저항 사용
- 사용하지 않는 74HC 입력은 floating 금지

## 점퍼선 색

| 색 | 역할 |
|---|---|
| 🟥 빨강 | POWER +5V |
| ⬛ 검정 | GND |
| 🟩 초록 | DATA |
| 🟨 노랑 | ADDRESS |
| 🟦 파랑 | CLOCK / RESET |
| 🟧 주황 | CONTROL |
| ⬜ 흰색 | STATUS / FLAG / SPECIAL |

## 단계

| 파일 | 만드는 것 | 주요 IC |
|---|---|---|
| [01_전원과_클럭.md](./01_전원과_클럭.md) | 전원 + Clock | U1 |
| [02_PC_MAR_Address.md](./02_PC_MAR_Address.md) | PC, MAR, Address MUX, RAM Bank Decoder | U2,U3,U16,U21,U22,U26 |
| [03_RAM과_DATA_BUS.md](./03_RAM과_DATA_BUS.md) | RAM 160byte, RAM BUS, Manual Input | U5~U9,U18,U20 |
| [04_A_Register_ALU.md](./04_A_Register_ALU.md) | A Register, ADD/SUB ALU, ALU BUS | U10~U14,U19,U23,U24 |
| [05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md) | IR, 명령 Decoder, Microstep, OUT | U4,U15,U17,U25,U27,U51,U63 |
| [06_Control_Logic.md](./06_Control_Logic.md) | 전체 제어 논리 | U28~U49 |
| [07_Flag_BootROM.md](./07_Flag_BootROM.md) | Z/MONITOR/HALT/KEY 상태 + Boot ROM | U52,U53,U60,U61 |
| [08_IO_LCD.md](./08_IO_LCD.md) | Memory-Mapped I/O + LCD | U50,LCD1 |
| [09_PS2_Keyboard.md](./09_PS2_Keyboard.md) | PS/2 Keyboard | U54~U59,U62,U64,Q1 |
| [10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md) | 전체 통합과 최종 확인 | 전체 |

## 현재 실제 제작 위치

현재까지 이미 만든 부분은 Clock, 8bit PC, MAR, Address MUX이며, 다음 실제 작업은 **U26 RAM Bank Decoder 검증 → U5 RAM #1** 순서로 진행하면 된다.

`컴퓨터만들기.md`와 이 폴더가 서로 다르면 **`컴퓨터만들기.md`의 최종 핀 배선 번호를 우선**하고, 이 폴더는 제작 순서와 테스트 방법을 위한 설명서로 사용한다.
