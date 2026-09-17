# 22~23단계 — Flag / Mode / Boot ROM

## 22단계 — U52/U53 74HC74

74HC74는 순간 신호를 상태로 기억한다.

### U52 — Z Flag / MONITOR_MODE

1. 🟦 /1CLR ← RESET_N
2. ⬜ 1D ← U48-4(ZERO)
3. 🟦 1CLK ← U31-8(Z_CLK)
4. 🟥 /1PRE → +5V
5. ⬜ 1Q=Z → U40-13
6. ⬜ /1Q=Z_N → U40-10
7. ⬛ GND
8. ⬜ /2Q=MONITOR_N → U43-1
9. ⬜ 2Q=MONITOR_MODE → U41-12
10. 🟦 /2PRE ← RESET_N
11. ⬛ 2CLK → GND
12. ⬛ 2D → GND
13. 🟧 /2CLR ← U41-6(RUN_T5_N)
14. 🟥 +5V

### U52 테스트

- ZERO=1 상태에서 Z_CLK 한 번 → Z=1
- ZERO=0 상태에서 Z_CLK 한 번 → Z=0
- RESET 직후 MONITOR_MODE=1
- RUN T5 조건 후 MONITOR_MODE=0

### U53 — KEY_READY / HALT

1. 🟦 /1CLR ← U35-8(KEY_CLR_N)
2. 🟥 1D → +5V
3. 🟦 1CLK ← U37-8(FRAME_CLK)
4. 🟥 /1PRE → +5V
5. ⬜ 1Q=KEY_READY → U57-2,Q1 Base 저항
6. ⬜ /1Q=KEY_READY_N → U37-5
7. ⬛ GND
8. ⬜ /2Q=RUN_EN → U28-2
9. ⬜ 2Q=HALT → 상태 LED 선택 가능
10. 🟧 /2PRE ← U41-8(HLT_T5_N)
11. ⬛ 2CLK → GND
12. ⬛ 2D → GND
13. 🟦 /2CLR ← RESET_N
14. 🟥 +5V

### U53 테스트

1. RESET 후 RUN_EN이 실행 허용 상태인지 확인한다.
2. HLT_T5_N을 발생시키면 HALT 상태가 저장되고 CPU Clock이 막히는지 확인한다.
3. RESET으로 다시 실행 가능한지 확인한다.

> 74HC74의 PRE/CLR는 Active-Low이므로 동시에 LOW로 만들지 않는다.

---

# 23단계 — U60/U61 Boot ROM

## U60 — AT28C64B Monitor ROM

1. NC
2. ⬛ A12 → GND
3. 🟨 A7 ← U3-11
4. 🟨 A6 ← U3-12
5. 🟨 A5 ← U3-13
6. 🟨 A4 ← U3-14
7. 🟨 A3 ← U2-11
8. 🟨 A2 ← U2-12
9. 🟨 A1 ← U2-13
10. 🟨 A0 ← U2-14
11. 🟩 I/O0 → U61-2
12. 🟩 I/O1 → U61-3
13. 🟩 I/O2 → U61-4
14. ⬛ GND
15. 🟩 I/O3 → U61-5
16. 🟩 I/O4 → U61-6
17. 🟩 I/O5 → U61-7
18. 🟩 I/O6 → U61-8
19. 🟩 I/O7 → U61-9
20. ⬛ /CE → GND
21. ⬛ A10 → GND
22. ⬛ /OE → GND
23. ⬛ A11 → GND
24. ⬛ A9 → GND
25. ⬛ A8 → GND
26. NC
27. 🟥 /WE → +5V
28. 🟥 +5V

## U61 — 74HC245 Boot ROM → DATA BUS

1. 🟥 DIR → +5V
2~9. 🟩 A1~A8 ← U60 I/O0~7
10. ⬛ GND
11~18. 🟩 B8~B1 ↔ DB7~DB0
19. 🟧 /OE ← U43-3
20. 🟥 +5V

### Boot ROM 테스트

1. EEPROM Programmer로 주소 0=0xAA, 1=0x55, 2=0xF0 같은 눈에 띄는 패턴을 기록한다.
2. PC를 0,1,2로 바꾸면서 U60 출력이 맞는지 확인한다.
3. U61 /OE 활성 때만 그 값이 DATA BUS에 나타나야 한다.
4. U61 /OE 비활성에서는 다른 BUS 장치와 충돌하지 않아야 한다.

## 다음 파일

[08_IO_LCD.md](./08_IO_LCD.md)
