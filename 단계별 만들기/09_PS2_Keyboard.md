# 9단계 — PS/2 키보드

이번 단계에서는 PS/2 키보드의 직렬 데이터를 받아서 Scan Code를 만들고, EEPROM으로 ASCII로 변환한 뒤 CPU DATA BUS에 넣는다.

전체 흐름:

```text
PS/2 Mini-DIN
↓
74HC14 신호 정리
↓
74HC161 비트 카운터
↓
74HC164 시프트 레지스터 2개
↓
AT28C64B Scan Code → ASCII ROM
↓
74HC157 STATUS/DATA MUX 2개
↓
74HC245 Keyboard DATA BUS Driver
↓
CPU DATA BUS
```

---

# 9-1. PS/2 데이터 형식

키보드는 키 하나를 보낼 때 한 프레임에 11비트를 보낸다.

```text
Start
D0
D1
D2
D3
D4
D5
D6
D7
Parity
Stop
```

우리가 필요한 핵심 값은 가운데 `D0~D7`, 즉 8비트 Scan Code다.

---

# 9-2. PS/2 Mini-DIN 6핀

> Mini-DIN 소켓은 앞에서 보는 핀 번호와 납땜면에서 보는 모습이 좌우 반대로 보일 수 있다. 반드시 실제 소켓 데이터시트 또는 핀 번호 표시를 확인한다.

연결:

```text
1번 DATA → 74HC14 5번 입력
2번 NC → 연결하지 않음
3번 GND → GND
4번 +5V → +5V
5번 CLOCK → 74HC14 1번 입력
             → NPN Clock Hold Collector
6번 NC → 연결하지 않음
```

## DATA Pull-up

```text
+5V → 4.7kΩ → PS/2 1번 DATA
```

## CLOCK Pull-up

```text
+5V → 4.7kΩ → PS/2 5번 CLOCK
```

PS/2 DATA와 CLOCK은 오픈 컬렉터 방식이므로 이 Pull-up이 필요하다.

---

# 9-3. 74HC14 — PS/2 Schmitt Trigger

PS/2의 CLOCK과 DATA 신호를 깨끗한 디지털 신호로 만든다.

## 전원

```text
7번 GND → GND
14번 VCC → +5V
```

14번과 7번 사이에 0.1µF를 연결한다.

## CLOCK 경로

```text
1번 1A ← PS/2 CLOCK raw
2번 1Y = PS2_INV_CLK → 같은 칩 3번
3번 2A ← 같은 칩 2번
4번 2Y = PS2_POST_CLK
```

두 번 반전하므로 4번은 원래 CLOCK과 같은 논리 방향이지만 Schmitt Trigger를 통과한 깨끗한 신호가 된다.

## DATA 경로

```text
5번 3A ← PS/2 DATA raw
6번 3Y → 같은 칩 9번
9번 4A ← 같은 칩 6번
8번 4Y = PS2_DATA_CLEAN → 앞단 74HC164 1번 A
```

## 미사용 입력

```text
11번 5A → GND
13번 6A → GND
10번 5Y → 연결하지 않음
12번 6Y → 연결하지 않음
```

## 단독 테스트

입력을 수동으로 HIGH/LOW로 바꾸며:

```text
1번 LOW  → 2번 HIGH
1번 HIGH → 2번 LOW

5번 LOW  → 6번 HIGH → 8번 LOW
5번 HIGH → 6번 LOW  → 8번 HIGH
```

인지 확인한다.

---

# 9-4. 74HC161 — PS/2 비트 카운터

현재 프레임에서 몇 번째 비트를 받고 있는지 센다.

## 연결

```text
1번 /CLR ← KEY_CLR_N
2번 CLK ← PS2_SAMPLE_CLK
3번 A → GND
4번 B → GND
5번 C → GND
6번 D → GND
7번 ENP → +5V
8번 GND → GND
9번 /LOAD → +5V
10번 ENT → +5V
11번 QD → 74HC08 OUT·LCD·PS2 12번
12번 QC → 74HC04 OUT/ZERO/I/O/PS2/RAM BUS 9번
13번 QB → 74HC139 확장명령 유효·PS2 카운트 디코더 13번
14번 QA → 같은 74HC139 14번
15번 RCO → 연결하지 않음
16번 VCC → +5V
```

16번과 8번 사이에 0.1µF를 연결한다.

## 테스트

2번 CLK에 pulse를 한 번씩 넣으면 QA~QD가 이진수로 증가해야 한다.

```text
0000
0001
0010
...
```

1번 `/CLR`를 GND로 내리면 바로 `0000`으로 돌아가야 한다.

---

# 9-5. 기존 74HC139의 PS/2 카운트 디코더 절반

5단계에서 만든 **확장명령 유효 디코더 74HC139의 두 번째 절반**을 이제 사용한다.

연결:

```text
13번 2B ← PS/2 비트 카운터 13번 QB
14번 2A ← PS/2 비트 카운터 14번 QA
15번 /2G → GND

9번 /2Y3 = LOWPAIR_N → 74HC04 OUT/ZERO/I/O/PS2/RAM BUS 11번
10번 /2Y2 → 사용하지 않음
11번 /2Y1 → 사용하지 않음
12번 /2Y0 → 사용하지 않음
```

이 칩의 8번 GND와 16번 VCC는 5단계에서 이미 연결되어 있어야 한다.

---

# 9-6. 74HC164 — PS/2 시프트 레지스터 앞단

직렬로 들어오는 비트를 Clock마다 한 칸씩 밀어 8비트 Scan Code를 만든다.

## 연결

```text
1번 A ← 74HC14 8번 PS2_DATA_CLEAN
2번 B → +5V
3번 QA = Stop bit 위치 → 사용하지 않음
4번 QB = Parity 위치 → 사용하지 않음
5번 QC = Scan bit7 → ASCII ROM 3번 A7
6번 QD = Scan bit6 → ASCII ROM 4번 A6
7번 GND → GND
8번 CLK ← PS2_SAMPLE_CLK
9번 /CLR ← RESET_N
10번 QE = Scan bit5 → ASCII ROM 5번 A5
11번 QF = Scan bit4 → ASCII ROM 6번 A4
12번 QG = Scan bit3 → ASCII ROM 7번 A3
13번 QH = Scan bit2 → 뒷단 74HC164 1번 A
                      → ASCII ROM 8번 A2
14번 VCC → +5V
```

14번과 7번 사이에 0.1µF를 연결한다.

---

# 9-7. 74HC164 — PS/2 시프트 레지스터 뒷단

앞단에서 밀려 나온 나머지 Scan Code bit1~0을 만든다.

```text
1번 A ← 앞단 74HC164 13번 QH
2번 B → +5V
3번 QA = Scan bit1 → ASCII ROM 9번 A1
4번 QB = Scan bit0 → ASCII ROM 10번 A0
5번 QC = Start bit 위치 → 사용하지 않음
6번 QD → 사용하지 않음
7번 GND → GND
8번 CLK ← PS2_SAMPLE_CLK
9번 /CLR ← RESET_N
10번 QE → 사용하지 않음
11번 QF → 사용하지 않음
12번 QG → 사용하지 않음
13번 QH → 사용하지 않음
14번 VCC → +5V
```

14번과 7번 사이에 0.1µF를 연결한다.

## 시프트 레지스터 테스트

실제 키보드를 연결하기 전에 74HC14 8번으로 들어갈 DATA를 수동으로 HIGH/LOW로 만들고 `PS2_SAMPLE_CLK`를 한 번씩 준다.

Scan bit7~0 출력이 Clock마다 한 칸씩 이동하는지 확인한다.

---

# 9-8. AT28C64B — Scan Code → ASCII ROM

Scan Code 8비트를 EEPROM의 주소 A0~A7로 넣는다.
그 주소에 미리 ASCII 값을 기록해두면 EEPROM 출력으로 ASCII가 나온다.

예:

```text
A키 Scan Code 주소 → 0x41 저장
```

그러면 A키 Scan Code가 주소에 들어왔을 때 ROM 출력은 ASCII `A`인 `0x41`이 된다.

## 주소 A0~A7

```text
3번 A7 ← 앞단 74HC164 5번
4번 A6 ← 앞단 74HC164 6번
5번 A5 ← 앞단 74HC164 10번
6번 A4 ← 앞단 74HC164 11번
7번 A3 ← 앞단 74HC164 12번
8번 A2 ← 앞단 74HC164 13번
9번 A1 ← 뒷단 74HC164 3번
10번 A0 ← 뒷단 74HC164 4번
```

## ASCII 출력

```text
11번 I/O0 → Keyboard MUX 하위 3번 1B
12번 I/O1 → Keyboard MUX 하위 6번 2B
13번 I/O2 → Keyboard MUX 하위 10번 3B
15번 I/O3 → Keyboard MUX 하위 13번 4B
16번 I/O4 → Keyboard MUX 상위 3번 1B
17번 I/O5 → Keyboard MUX 상위 6번 2B
18번 I/O6 → Keyboard MUX 상위 10번 3B
19번 I/O7 → Keyboard MUX 상위 13번 4B
```

## 고정핀

```text
2번 A12 → GND
14번 GND → GND
20번 /CE → GND
21번 A10 → GND
22번 /OE → GND
23번 A11 → GND
24번 A9 → GND
25번 A8 → GND
27번 /WE → +5V
28번 VCC → +5V
```

```text
1번 NC → 연결하지 않음
26번 NC → 연결하지 않음
```

28번과 14번 사이에 0.1µF를 연결한다.

## ROM 단독 테스트

EEPROM Programmer로 A키 Scan Code 주소에:

```text
0x41
```

을 기록한다.

그 Scan Code를 A0~A7에 넣었을 때 I/O7~I/O0이:

```text
01000001
```

인지 확인한다.

---

# 9-9. 74HC157 두 개 — KEY_STATUS / KEY_DATA 선택

메모리 맵 I/O에서:

```text
주소 160 → A0=0 → KEY_STATUS
주소 161 → A0=1 → KEY_DATA
```

이므로 ADDRESS A0 하나로 STATUS와 DATA를 선택한다.

---

## 하위 74HC157

### 기본핀

```text
1번 S ← ADDRESS A0
8번 GND → GND
15번 /G → GND
16번 VCC → +5V
```

### bit0~3

```text
2번 1A ← KEY_READY
3번 1B ← ASCII ROM 11번 I/O0
4번 1Y → Keyboard 74HC245 2번 A1

5번 2A → GND
6번 2B ← ASCII ROM 12번 I/O1
7번 2Y → Keyboard 74HC245 3번 A2

11번 3A → GND
10번 3B ← ASCII ROM 13번 I/O2
9번 3Y → Keyboard 74HC245 4번 A3

14번 4A → GND
13번 4B ← ASCII ROM 15번 I/O3
12번 4Y → Keyboard 74HC245 5번 A4
```

---

## 상위 74HC157

```text
1번 S ← ADDRESS A0
8번 GND → GND
15번 /G → GND
16번 VCC → +5V
```

### bit4~7

```text
2번 1A → GND
3번 1B ← ASCII ROM 16번 I/O4
4번 1Y → Keyboard 74HC245 6번 A5

5번 2A → GND
6번 2B ← ASCII ROM 17번 I/O5
7번 2Y → Keyboard 74HC245 7번 A6

11번 3A → GND
10번 3B ← ASCII ROM 18번 I/O6
9번 3Y → Keyboard 74HC245 8번 A7

14번 4A → GND
13번 4B ← ASCII ROM 19번 I/O7
12번 4Y → Keyboard 74HC245 9번 A8
```

두 74HC157 모두 16번과 8번 사이에 0.1µF를 연결한다.

## MUX 테스트

```text
ADDRESS A0 = 0
→ 출력 = 0000000(KEY_READY)

ADDRESS A0 = 1
→ 출력 = ASCII 8비트
```

정확히는 STATUS에서 bit0만 KEY_READY이고 bit1~7은 0이다.

---

# 9-10. 74HC245 — Keyboard DATA BUS Driver

Keyboard MUX 결과를 CPU DATA BUS에 내보낸다.

## 전원과 방향

```text
1번 DIR → +5V
10번 GND → GND
20번 VCC → +5V
```

방향은 A→B 고정이다.

## A쪽

```text
2번 A1 ← 하위 Keyboard MUX 4번
3번 A2 ← 하위 MUX 7번
4번 A3 ← 하위 MUX 9번
5번 A4 ← 하위 MUX 12번
6번 A5 ← 상위 MUX 4번
7번 A6 ← 상위 MUX 7번
8번 A7 ← 상위 MUX 9번
9번 A8 ← 상위 MUX 12번
```

## B쪽 → DATA BUS

```text
18번 B1 → DB0
17번 B2 → DB1
16번 B3 → DB2
15번 B4 → DB3
14번 B5 → DB4
13번 B6 → DB5
12번 B7 → DB6
11번 B8 → DB7
```

## Enable

```text
19번 /OE ← 74HC32 Boot·Keyboard·LCD BUS 제어 칩 6번 KEY_READ_N
```

```text
19번 LOW  → Keyboard 값을 DATA BUS에 출력
19번 HIGH → DATA BUS에서 분리
```

20번과 10번 사이에 0.1µF를 연결한다.

---

# 9-11. NPN 트랜지스터 — PS/2 Clock Hold

키 하나를 받은 뒤 CPU가 그 데이터를 읽기 전에 다음 키 프레임이 들어오지 않도록 PS/2 CLOCK을 LOW로 잡는다.

연결:

```text
Collector → PS/2 CLOCK 선
Emitter → GND
Base ← 74HC74 KEY_READY·HALT 5번 KEY_READY
       사이에 4.7kΩ~10kΩ 저항
```

> NPN 트랜지스터의 E/B/C 다리 순서는 부품마다 다를 수 있다. 실제 사용하는 트랜지스터의 데이터시트를 확인한다.

KEY_READY가 HIGH일 때 트랜지스터가 CLOCK을 잡는 구조다.

---

# 9-12. 실제 키보드 테스트

전체 CPU 자동 실행 전에 PS/2 경로만 단계별로 확인한다.

## 1. 키보드 연결

전원을 끈 상태에서 PS/2 키보드를 연결하고 전원을 켠다.

## 2. A키 누르기

확인 순서:

```text
PS/2 CLOCK raw
↓
74HC14 2번 PS2_INV_CLK / 4번 PS2_POST_CLK
↓
PS2_SAMPLE_CLK
↓
74HC161 비트 카운터
↓
74HC164 두 개의 Scan Code
↓
ASCII ROM 출력
↓
KEY_READY
```

## 3. KEY_STATUS 확인

주소 160을 선택했을 때 DATA BUS bit0에 KEY_READY가 나타나는지 확인한다.

## 4. KEY_DATA 확인

주소 161을 선택했을 때 A키라면:

```text
DB7~DB0 = 01000001 = 0x41
```

이 나와야 한다.

## 5. ACK 확인

CPU가 KEY_DATA를 읽은 뒤:

```text
KEY_READY → LOW
```

로 돌아가야 한다.

그 다음 키 입력을 다시 받을 수 있어야 한다.

---

# 9단계 완료 체크

- [ ] PS/2 DATA Pull-up 정상
- [ ] PS/2 CLOCK Pull-up 정상
- [ ] 74HC14 CLOCK 경로 정상
- [ ] 74HC14 DATA 경로 정상
- [ ] PS/2 비트 카운터 정상
- [ ] 74HC164 시프트 정상
- [ ] Scan Code→ASCII ROM 정상
- [ ] ADDRESS A0=0에서 STATUS
- [ ] ADDRESS A0=1에서 ASCII DATA
- [ ] Keyboard 74HC245 19번 /OE 정상
- [ ] A키 → 0x41
- [ ] KEY_READY Set/Clear 정상
- [ ] 다음 키를 연속으로 받을 수 있음

## 다음 단계

[10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md)