# MAKECOMPUTER/8 단계별 만들기

이 폴더는 `컴퓨터만들기.md`의 최종 회로를 **처음 만드는 사람도 실제 브레드보드에서 그대로 따라갈 수 있게** 순서대로 설명한 제작 설명서다.

단순히 핀 연결표만 나열하지 않고, 각 단계에서:

```text
무엇을 만드는지
↓
왜 필요한지
↓
몇 번 핀을 어디에 연결하는지
↓
어떻게 테스트하는지
↓
정상이면 어떤 값이 나와야 하는지
```

순서로 설명한다.

---

# 1. 이 설명서의 가장 중요한 규칙

## 부품 이름 + 역할 + 핀 번호로 설명한다

`U1`, `U2`, `U18`처럼 회로도를 봐야만 알 수 있는 칩 번호 별칭은 사용하지 않는다.

항상 다음처럼 쓴다.

```text
74HC161 PC 하위 4비트 카운터 14번 QA
→ 74HC157 주소 선택 MUX 하위칩 2번 1A
```

또는 짧게 쓸 때도 역할이 구분되도록:

```text
RAM쪽 245 #1 19번 /OE → GND
푸시버튼쪽 245 #2 19번 /OE → +5V
```

처럼 적는다.

---

# 2. 점퍼선 색은 규칙으로 사용하지 않는다

이 설명서에서는 **점퍼선 색으로 신호 종류를 구분하지 않는다.**

어떤 색의 점퍼선을 사용하든 전기적으로 올바르게 연결되어 있으면 된다.

따라서 배선을 확인할 때는 색이 아니라 반드시:

```text
출발 부품
출발 핀 번호
도착 부품
도착 핀 번호
신호 이름
```

을 확인한다.

예:

```text
74HC273 A 레지스터 2번 Q0
→ 하위 74HC283 5번 A0
```

이 연결에서 점퍼선 색은 중요하지 않다.

---

# 3. HIGH와 LOW

이 설명서에서:

```text
HIGH = +5V
LOW  = GND
```

를 뜻한다.

예:

```text
245 #1 19번 /OE → GND
```

라고 적혀 있으면 19번 핀을 LOW로 만드는 것이다.

```text
245 #1 19번 /OE → +5V
```

라고 적혀 있으면 19번 핀을 HIGH로 만드는 것이다.

---

# 4. `/` 또는 `_N`이 붙은 신호

다음처럼 이름에 `/`가 붙거나 `_N`으로 끝나는 신호는 대부분 **Active-Low**다.

```text
/OE
/CLR
/LOAD
LDA_N
MRD
MWR
```

Active-Low는 LOW일 때 기능이 켜진다는 뜻이다.

예를 들어 74HC245의 19번 `/OE`:

```text
19번 /OE = LOW(GND)  → 출력 활성화
19번 /OE = HIGH(+5V) → 출력 비활성화
```

따라서 단순히 `HIGH=켜짐`, `LOW=꺼짐`이라고 생각하면 안 된다.
각 핀의 기능을 기준으로 판단한다.

---

# 5. 전원핀은 테스트 중 함부로 움직이지 않는다

제어핀을 바꿀 때 VCC나 GND 핀과 헷갈리지 않도록 주의한다.

예를 들어 74HC245는:

```text
20번 VCC → +5V
10번 GND → GND
```

를 기본적으로 계속 유지한다.

테스트할 때 주로 바꾸는 핀은:

```text
1번 DIR = 데이터 방향
19번 /OE = 출력 활성/비활성
```

이다.

즉 RAM 읽기/쓰기 테스트에서 20번 VCC를 움직이는 것이 아니라 **1번과 19번을 제어**한다.

다른 IC도 마찬가지로 VCC/GND는 기본 전원 연결로 유지하고, Clock/Enable/Select/Read/Write 핀을 조작한다.

---

# 6. 같은 신호를 여러 입력으로 보내는 것은 가능하다

하나의 IC 출력이 여러 IC의 입력으로 갈 수 있다.

예:

```text
A 레지스터 19번 Q7
├→ 상위 74HC283 12번 A3
└→ A/ALU 선택 MUX 상위칩 14번 4A
```

이런 분기는 정상이다.

하지만 **서로 다른 두 출력핀을 직접 연결하면 안 된다.**

특히 CPU DATA BUS에 연결된 여러 74HC245는 동시에 출력하지 않도록 `/OE`를 제어해야 한다.

---

# 7. DATA BUS와 RAM_D는 다르다

이 프로젝트에서는 다음 두 종류의 데이터선을 구분한다.

```text
DB0~DB7
= CPU 전체가 공유하는 DATA BUS

RAM_D0~RAM_D7
= RAM과 RAM쪽 74HC245 사이의 RAM 전용 데이터선
```

RAM쪽 74HC245를 `245 #1`이라고 부른다.

예:

```text
245 #1 2번 A1  = RAM_D0 쪽
245 #1 18번 B1 = DB0 쪽
```

따라서 `RAM_D0`와 `DB0`를 같은 선으로 생각하면 안 된다.

---

# 8. 74HC245 이름 규칙

3단계에서 사용하는 두 74HC245는 다음 이름으로 통일한다.

```text
245 #1 = RAM에 직접 연결된 74HC245
245 #2 = 푸시버튼/수동 입력에 연결된 74HC245
```

구조:

```text
푸시버튼
   ↓
245 #2
   ↓
DB0~DB7
   ↓
245 #1
   ↓
RAM_D0~RAM_D7
   ↓
RAM
```

245 #1과 #2의 11~18번은 같은 DATA BUS에 연결된다.

---

# 9. 제작할 때 지켜야 할 순서

1. 전원을 끄고 배선한다.
2. 새 IC의 VCC/GND부터 확인한다.
3. 0.1µF 디커플링 커패시터를 연결한다.
4. 입력핀을 floating 상태로 두지 않는다.
5. 한 번에 한 부품 또는 한 기능만 추가한다.
6. 추가한 부분을 단독 테스트한다.
7. 단독 테스트가 성공한 뒤 이전 회로와 연결한다.
8. 문제가 생기면 마지막으로 추가한 부분부터 확인한다.
9. DATA BUS Driver를 켜기 전에 다른 Driver가 꺼져 있는지 확인한다.
10. 전체 CPU 자동 실행은 각 블록 테스트가 끝난 뒤 한다.

---

# 10. 멀티미터로 확인하는 기본 방법

디지털 신호를 확인할 때는 멀티미터 DC 전압 모드를 사용한다.

```text
검정 프로브 → 공통 GND
빨강 프로브 → 확인할 핀
```

대략:

```text
0V 부근 → LOW
5V 부근 → HIGH
```

으로 판단할 수 있다.

LED를 테스트점에 사용할 때는 반드시 330Ω~1kΩ 정도의 직렬 저항을 사용한다.

Active-Low 출력을 LED로 보고 싶다면 다음 방식이 편하다.

```text
+5V → 1kΩ → LED → Active-Low 출력
```

이 경우 해당 출력이 LOW가 되었을 때 LED가 켜진다.

---

# 11. 각 단계 파일

반드시 아래 순서로 진행한다.

1. [01_전원과_클럭.md](./01_전원과_클럭.md)
   - 5V 전원
   - 공통 GND
   - NE555 Clock
   - Clock LED 테스트

2. [02_PC_MAR_Address.md](./02_PC_MAR_Address.md)
   - 74HC161 두 개로 8비트 PC
   - 74HC273 MAR
   - 74HC157 두 개로 PC/MAR 주소 선택
   - 74HC138 RAM 뱅크 선택

3. [03_RAM과_DATA_BUS.md](./03_RAM과_DATA_BUS.md)
   - CDP1824CE RAM #1~#5
   - RAM_D0~RAM_D7
   - 245 #1 RAM Driver
   - DB0~DB7
   - 245 #2 수동 입력
   - RAM Write / Read 테스트

4. [04_A_Register_ALU.md](./04_A_Register_ALU.md)
   - 74HC273 A 레지스터
   - 74HC86 두 개
   - 74HC283 두 개
   - ADD / SUB
   - A/ALU 선택 MUX
   - A/ALU DATA BUS Driver

5. [05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md)
   - 명령어 레지스터 IR
   - 기본/확장 명령 디코더
   - Microstep Counter
   - T0~T5 Decoder
   - OUT 레지스터

6. [06_Control_Logic.md](./06_Control_Logic.md)
   - 74HC08 AND
   - 74HC32 OR
   - 74HC04 NOT
   - CPU Clock
   - 각 레지스터 Clock
   - RAM Read/Write
   - DATA BUS Enable
   - ALU/주소 선택 자동 제어

7. [07_Flag_BootROM.md](./07_Flag_BootROM.md)
   - Z Flag
   - MONITOR_MODE
   - HALT / RUN_EN
   - KEY_READY
   - AT28C64B Boot ROM

8. [08_IO_LCD.md](./08_IO_LCD.md)
   - 주소 160~163 Memory-Mapped I/O
   - 74HC138 I/O Decoder
   - 20×4 LCD

9. [09_PS2_Keyboard.md](./09_PS2_Keyboard.md)
   - PS/2 CLOCK / DATA
   - 74HC14
   - PS/2 bit counter
   - 74HC164 shift register
   - Scan Code→ASCII ROM
   - Keyboard DATA BUS Driver

10. [10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md)
    - 전원/공통 GND 최종 확인
    - DATA BUS 충돌 확인
    - Reset
    - 실제 명령 실행
    - Boot ROM
    - LCD
    - PS/2
    - 전체 Monitor 테스트

---

# 12. 가장 중요한 원칙 한 줄

배선이 맞는지는 **점퍼선 색이 아니라 `어느 칩의 몇 번 핀이 어느 칩의 몇 번 핀에 연결되어 있는가`로 판단한다.**

실제로 만들 때는 `01 → 02 → 03 → ... → 10` 순서대로 진행한다.