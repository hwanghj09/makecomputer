# 11~13단계 — A Register와 ALU

## 11단계 — U14 74HC273 A Register

A Register는 계산의 중심이다.

1. 🟦 RESET_N
2. 🟩 Q0 → U10-5, U23-2
3. 🟩 D0 ← DB0
4. 🟩 D1 ← DB1
5. 🟩 Q1 → U10-3, U23-5
6. 🟩 Q2 → U10-14, U23-11
7. 🟩 D2 ← DB2
8. 🟩 D3 ← DB3
9. 🟩 Q3 → U10-12, U23-14
10. ⬛ GND
11. 🟦 CLK ← U30-6
12. 🟩 Q4 → U11-5, U24-2
13. 🟩 D4 ← DB4
14. 🟩 D5 ← DB5
15. 🟩 Q5 → U11-3, U24-5
16. 🟩 Q6 → U11-14, U24-11
17. 🟩 D6 ← DB6
18. 🟩 D7 ← DB7
19. 🟩 Q7 → U11-12, U24-14
20. 🟥 +5V

### 테스트

U20으로 DATA BUS에 `00110101`을 만들고 A_CLK를 한 번 준다. Q0~Q7이 같은 값인지 확인한다. 이후 DATA BUS를 바꿔도 A_CLK가 없으면 값이 유지되어야 한다.

---

## 12단계 — U10/U11 74HC283 + U12/U13 74HC86

### U10 — ALU 하위 4bit

1. 🟩 S1(ALU1) → U23-6,U44-5
2. 🟩 B1 ← U12-6
3. 🟩 A1 ← U14-5
4. 🟩 S0(ALU0) → U23-3,U44-4
5. 🟩 A0 ← U14-2
6. 🟩 B0 ← U12-3
7. 🟧 CIN ← U47-4
8. ⬛ GND
9. 🟩 COUT → U11-7
10. 🟩 S3(ALU3) → U23-13,U44-10
11. 🟩 B3 ← U12-11
12. 🟩 A3 ← U14-9
13. 🟩 S2(ALU2) → U23-10,U44-9
14. 🟩 A2 ← U14-6
15. 🟩 B2 ← U12-8
16. 🟥 +5V

### U11 — ALU 상위 4bit

1. 🟩 S1(ALU5) → U24-6,U44-13
2. 🟩 B1 ← U13-6
3. 🟩 A1 ← U14-15
4. 🟩 S0(ALU4) → U24-3,U44-12
5. 🟩 A0 ← U14-12
6. 🟩 B0 ← U13-3
7. 🟩 CIN ← U10-9
8. ⬛ GND
9. 배선 없음: COUT
10. 🟩 S3(ALU7) → U24-13,U45-2
11. 🟩 B3 ← U13-11
12. 🟩 A3 ← U14-19
13. 🟩 S2(ALU6) → U24-10,U45-1
14. 🟩 A2 ← U14-16
15. 🟩 B2 ← U13-8
16. 🟥 +5V

### U12 — RAM_D0~3 XOR

1. 🟩 RAM_D0
2. 🟧 SUB_MODE ← U47-4
3. 🟩 → U10-6
4. 🟩 RAM_D1
5. 🟧 SUB_MODE
6. 🟩 → U10-2
7. ⬛ GND
8. 🟩 → U10-15
9. 🟩 RAM_D2
10. 🟧 SUB_MODE
11. 🟩 → U10-11
12. 🟩 RAM_D3
13. 🟧 SUB_MODE
14. 🟥 +5V

### U13 — RAM_D4~7 XOR

1. 🟩 RAM_D4
2. 🟧 SUB_MODE
3. 🟩 → U11-6
4. 🟩 RAM_D5
5. 🟧 SUB_MODE
6. 🟩 → U11-2
7. ⬛ GND
8. 🟩 → U11-15
9. 🟩 RAM_D6
10. 🟧 SUB_MODE
11. 🟩 → U11-11
12. 🟩 RAM_D7
13. 🟧 SUB_MODE
14. 🟥 +5V

### ALU 테스트

- A=5, RAM_D=3, SUB_MODE=0 → ALU=8
- A=5, RAM_D=3, SUB_MODE=1 → ALU=2
- U10-9 COUT → U11-7 CIN 연결을 반드시 확인한다.

---

## 13단계 — U23/U24 MUX + U19 BUS Driver

### U23 — 하위 4bit A/ALU MUX

1. 🟧 S ← U47-2
2. 🟩 A0 ← U14-2
3. 🟩 ALU0 ← U10-4
4. 🟩 → U19-2
5. 🟩 A1 ← U14-5
6. 🟩 ALU1 ← U10-1
7. 🟩 → U19-3
8. ⬛ GND
9. 🟩 → U19-4
10. 🟩 ALU2 ← U10-13
11. 🟩 A2 ← U14-6
12. 🟩 → U19-5
13. 🟩 ALU3 ← U10-10
14. 🟩 A3 ← U14-9
15. ⬛ /G → GND
16. 🟥 +5V

### U24 — 상위 4bit A/ALU MUX

1. 🟧 S ← U47-2
2. 🟩 A4 ← U14-12
3. 🟩 ALU4 ← U11-4
4. 🟩 → U19-6
5. 🟩 A5 ← U14-15
6. 🟩 ALU5 ← U11-1
7. 🟩 → U19-7
8. ⬛ GND
9. 🟩 → U19-8
10. 🟩 ALU6 ← U11-13
11. 🟩 A6 ← U14-16
12. 🟩 → U19-9
13. 🟩 ALU7 ← U11-10
14. 🟩 A7 ← U14-19
15. ⬛ /G → GND
16. 🟥 +5V

### U19 — A/ALU → DATA BUS

1. 🟥 DIR → +5V
2~9. 🟩 A1~A8 ← U23/U24 출력
10. ⬛ GND
11~18. 🟩 B8~B1 ↔ DB7~DB0
19. 🟧 /OE ← U42-11
20. 🟥 +5V

### 테스트

1. A와 ALU 결과를 서로 다르게 만든다.
2. U23/U24 Select를 바꿔 U19 입력이 A/ALU 사이에서 바뀌는지 확인한다.
3. U19 /OE 활성 때만 DATA BUS에 값이 나타나야 한다.

## 다음 파일

[05_IR_Microstep_Decoder_OUT.md](./05_IR_Microstep_Decoder_OUT.md)
