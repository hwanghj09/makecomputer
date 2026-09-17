# 25단계 — PS/2 Keyboard 전체

> 이 단계는 가장 복잡하다. **U62 → U64 → U54/U55 → U56 → U57/U58 → U59 → 실제 키보드** 순서로 한 부분씩 시험한다.

## PS/2 Mini-DIN 6핀

1. 🟩 DATA → +5V에 4.7kΩ Pull-up, U62-5
2. NC
3. ⬛ GND
4. 🟥 +5V
5. 🟦 CLOCK → +5V에 4.7kΩ Pull-up, U62-1, Q1 Collector
6. NC

> 앞면과 납땜면은 좌우가 뒤집혀 보일 수 있으므로 실제 소켓 핀번호를 확인한다.

---

## U62 — 74HC14 Schmitt Trigger

1. 🟦 1A ← PS/2 CLOCK raw
2. 🟦 1Y → U37-4
3. 🟦 2A ← U62-2
4. 🟦 2Y → U37-9
5. 🟩 3A ← PS/2 DATA raw
6. 🟩 3Y → U62-9
7. ⬛ GND
8. 🟩 4Y → U54-1
9. 🟩 4A ← U62-6
10. 배선 없음 5Y
11. ⬛ 5A → GND
12. 배선 없음 6Y
13. ⬛ 6A → GND
14. 🟥 +5V

### U62 테스트

CLOCK/DATA 입력을 천천히 HIGH/LOW로 바꿔 출력이 깨끗하게 반전되는지 확인한다.

---

## U64 — 74HC161 PS/2 Bit Counter

1. 🟦 /CLR ← U35-8(KEY_CLR_N)
2. 🟦 CLK ← U37-6
3. ⬛ A → GND
4. ⬛ B → GND
5. ⬛ C → GND
6. ⬛ D → GND
7. 🟥 ENP → +5V
8. ⬛ GND
9. 🟥 /LOAD → +5V
10. 🟥 ENT → +5V
11. ⬜ QD → U36-12
12. ⬜ QC → U48-9
13. ⬜ QB → U63-13
14. ⬜ QA → U63-14
15. 배선 없음 RCO
16. 🟥 +5V

### U64 테스트

Sample Clock를 수동으로 넣어 QA/QB/QC/QD가 이진수로 증가하는지 확인한다. /CLR를 LOW로 하면 0000으로 돌아가야 한다.

---

## U54 — 74HC164 Shift Register #1

1. 🟩 A ← U62-8(PS2_DATA_CLEAN)
2. 🟥 B → +5V
3. 배선 없음 QA(Stop 위치)
4. 배선 없음 QB(Parity 위치)
5. 🟩 QC=Scan bit7 → U56-3
6. 🟩 QD=Scan bit6 → U56-4
7. ⬛ GND
8. 🟦 CLK ← U37-6
9. 🟦 /CLR ← RESET_N
10. 🟩 QE=Scan bit5 → U56-5
11. 🟩 QF=Scan bit4 → U56-6
12. 🟩 QG=Scan bit3 → U56-7
13. 🟩 QH=Scan bit2 → U55-1,U56-8
14. 🟥 +5V

## U55 — 74HC164 Shift Register #2

1. 🟩 A ← U54-13
2. 🟥 B → +5V
3. 🟩 QA=Scan bit1 → U56-9
4. 🟩 QB=Scan bit0 → U56-10
5. 배선 없음 QC(Start 위치)
6. 배선 없음 QD
7. ⬛ GND
8. 🟦 CLK ← U37-6
9. 🟦 /CLR ← RESET_N
10~13. 배선 없음
14. 🟥 +5V

### Shift 테스트

실제 키보드 전에 DATA를 수동으로 만들고 Clock를 한 번씩 넣어 bit가 한 칸씩 이동하는지 본다.

---

## U56 — AT28C64B Scan Code → ASCII ROM

1. NC
2. ⬛ A12 → GND
3. 🟨 A7 ← U54-5
4. 🟨 A6 ← U54-6
5. 🟨 A5 ← U54-10
6. 🟨 A4 ← U54-11
7. 🟨 A3 ← U54-12
8. 🟨 A2 ← U54-13
9. 🟨 A1 ← U55-3
10. 🟨 A0 ← U55-4
11. 🟩 I/O0 → U57-3
12. 🟩 I/O1 → U57-6
13. 🟩 I/O2 → U57-10
14. ⬛ GND
15. 🟩 I/O3 → U57-13
16. 🟩 I/O4 → U58-3
17. 🟩 I/O5 → U58-6
18. 🟩 I/O6 → U58-10
19. 🟩 I/O7 → U58-13
20. ⬛ /CE → GND
21. ⬛ A10 → GND
22. ⬛ /OE → GND
23. ⬛ A11 → GND
24. ⬛ A9 → GND
25. ⬛ A8 → GND
26. NC
27. 🟥 /WE → +5V
28. 🟥 +5V

### U56 테스트

EEPROM에 먼저 A키 Scan Code 주소에 ASCII `0x41`을 기록하고, 해당 Scan Code 입력에서 출력이 `01000001`인지 확인한다.

---

## U57 — 74HC157 STATUS/DATA 하위 4bit

1. 🟨 S ← U21-4(A0)
2. ⬜ 1A ← U53-5(KEY_READY)
3. 🟩 1B ← U56-11
4. 🟩 1Y → U59-2
5. ⬛ 2A → GND
6. 🟩 2B ← U56-12
7. 🟩 2Y → U59-3
8. ⬛ GND
9. 🟩 3Y → U59-4
10. 🟩 3B ← U56-13
11. ⬛ 3A → GND
12. 🟩 4Y → U59-5
13. 🟩 4B ← U56-15
14. ⬛ 4A → GND
15. ⬛ /G → GND
16. 🟥 +5V

## U58 — 74HC157 STATUS/DATA 상위 4bit

1. 🟨 S ← U21-4(A0)
2. ⬛ 1A → GND
3. 🟩 1B ← U56-16
4. 🟩 1Y → U59-6
5. ⬛ 2A → GND
6. 🟩 2B ← U56-17
7. 🟩 2Y → U59-7
8. ⬛ GND
9. 🟩 3Y → U59-8
10. 🟩 3B ← U56-18
11. ⬛ 3A → GND
12. 🟩 4Y → U59-9
13. 🟩 4B ← U56-19
14. ⬛ 4A → GND
15. ⬛ /G → GND
16. 🟥 +5V

### U57/U58 테스트

- A0=0 → STATUS: bit0=KEY_READY, 나머지 0
- A0=1 → DATA: ASCII 8bit

---

## U59 — 74HC245 Keyboard → DATA BUS

1. 🟥 DIR → +5V
2. 🟩 A1 ← U57-4
3. 🟩 A2 ← U57-7
4. 🟩 A3 ← U57-9
5. 🟩 A4 ← U57-12
6. 🟩 A5 ← U58-4
7. 🟩 A6 ← U58-7
8. 🟩 A7 ← U58-9
9. 🟩 A8 ← U58-12
10. ⬛ GND
11~18. 🟩 B8~B1 ↔ DB7~DB0
19. 🟧 /OE ← U43-6
20. 🟥 +5V

### U59 테스트

/OE가 활성일 때만 STATUS/DATA가 CPU DATA BUS에 나타나는지 확인한다.

---

## Q1 — NPN PS/2 Clock Hold

- 🟦 Collector → PS/2 CLOCK
- ⬛ Emitter → GND
- ⬜ Base ← U53-5(KEY_READY), 4.7kΩ~10kΩ 직렬 저항

> 실제 E/B/C 다리 순서는 구매한 트랜지스터 데이터시트를 확인한다.

## 실제 키보드 최종 테스트

1. A키를 누른다.
2. KEY_READY가 1이 되는지 본다.
3. KEY_DATA에서 ASCII `0x41`이 읽히는지 확인한다.
4. KEY_DATA를 읽은 뒤 ACK/CLR가 발생해 다음 키를 받을 준비가 되는지 확인한다.

## 다음 파일

[10_전체통합_최종테스트.md](./10_전체통합_최종테스트.md)
