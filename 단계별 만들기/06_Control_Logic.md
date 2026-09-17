# 6단계 — 자동 제어 논리

이 단계가 가장 복잡하다. **한 칩씩, 한 게이트씩** 만든다.

이 파일에서도 칩 번호 별칭은 쓰지 않고 `부품명 + 역할`로 구분한다.

## 점퍼선 색

- 🟥 빨강 = +5V
- ⬛ 검정 = GND
- 🟩 초록 = 실제 DATA 비트
- 🟨 노랑 = 실제 ADDRESS 비트
- 🟦 파랑 = CLOCK / RESET / CLEAR
- 🟧 주황 = CONTROL
- ⬜ 흰색 = STATUS / FLAG / SPECIAL

74HC08/74HC32/74HC04는 모두 14핀이다. 모든 칩에서 **14번 VCC=🟥 빨강, 7번 GND=⬛ 검정**, 그리고 14↔7 사이 0.1µF를 단다.

## 먼저 논리게이트 뜻

```text
AND: 두 입력이 모두 HIGH일 때만 HIGH
OR : 하나라도 HIGH면 HIGH
NOT: 입력을 반대로 출력
```

`_N` 또는 `/`가 붙은 신호는 보통 **LOW일 때 활성**이다.

---

# 6-1. 74HC08 CPU 클럭·2바이트 판정 AND 칩

1. 🟦 **파랑** — 1번 ← NE555 클럭 발생기 3번 RAW_CLK
2. ⬜ **흰색** — 2번 ← RUN_EN
3. 🟦 **파랑** — 3번 CPU_CLK → PC 하위 카운터 2번, PC 상위 카운터 2번, 마이크로스텝 카운터 2번
4. 🟧 **주황** — 4번 ← NOP_N
5. 🟧 **주황** — 5번 ← OUT_N
6. 🟧 **주황** — 6번 BYTE2_A → 같은 칩 9번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 BYTE2 → 같은 칩 13번
9. 🟧 **주황** — 9번 ← 같은 칩 6번 BYTE2_A
10. 🟧 **주황** — 10번 ← HLT_N
11. 🟧 **주황** — 11번 T3_BYTE2 → MAR·A실행 AND 칩 1번, 확장명령·PC카운트·LDI OR 칩 10번
12. 🟧 **주황** — 12번 ← T3
13. 🟧 **주황** — 13번 ← 같은 칩 8번 BYTE2
14. 🟥 **빨강** — 14번 → +5V

처음에는 RUN_EN 대신 2번을 🟥 +5V에 임시 고정해서 Clock 전달부터 시험해도 된다.

---

# 6-2. 74HC08 MAR·A실행 제어 AND 칩

1. 🟧 **주황** — 1번 ← T3_BYTE2
2. 🟧 **주황** — 2번 ← LDI_N
3. 🟧 **주황** — 3번 MAR_EN → 같은 칩 5번
4. 🟦 **파랑** — 4번 ← CPU_CLK
5. 🟧 **주황** — 5번 ← 같은 칩 3번 MAR_EN
6. 🟦 **파랑** — 6번 MAR_CLK → 74HC273 메모리 주소 레지스터 11번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 AEXEC_TMP → 같은 칩 12번
9. 🟧 **주황** — 9번 ← LDA_N
10. 🟧 **주황** — 10번 ← ADD_N
11. 🟧 **주황** — 11번 A_EXEC_N → A·IR 클럭 AND 칩 2번, 점프·주소·읽기 AND 칩 12번
12. 🟧 **주황** — 12번 ← 같은 칩 8번 AEXEC_TMP
13. 🟧 **주황** — 13번 ← SUB_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-3. 74HC08 A·IR 클럭 제어 AND 칩

1. 🟧 **주황** — 1번 ← LDI_T3_N
2. 🟧 **주황** — 2번 ← T5_AEXEC_N
3. 🟧 **주황** — 3번 A_EN_N → IR·T-state·A Enable 인버터 13번
4. 🟦 **파랑** — 4번 ← CPU_CLK
5. 🟧 **주황** — 5번 ← A_EN
6. 🟦 **파랑** — 6번 A_CLK → 74HC273 A 레지스터 11번, 키보드·LCD·ACK AND 칩 4번
7. ⬛ **검정** — 7번 → GND
8. 🟦 **파랑** — 8번 IR_CLK → 74HC273 명령어 레지스터 11번
9. 🟦 **파랑** — 9번 ← CPU_CLK
10. 🟧 **주황** — 10번 ← T1
11. 🟧 **주황** — 11번 ADD_SUB_N → SUB·CMP·Z·점프 AND 칩 4번, RAM 버스·A/OUT/ALU AND 칩 13번, ALU·SUB·Z·Address·LCD 인버터 1번
12. 🟧 **주황** — 12번 ← ADD_N
13. 🟧 **주황** — 13번 ← SUB_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-4. 74HC08 SUB·CMP·Z·점프 제어 AND 칩

1. 🟧 **주황** — 1번 ← SUB_N
2. 🟧 **주황** — 2번 ← CMP_N
3. 🟧 **주황** — 3번 SUBCMP_N → ALU·SUB·Z·Address·LCD 인버터 3번
4. 🟧 **주황** — 4번 ← ADD_SUB_N
5. 🟧 **주황** — 5번 ← CMP_N
6. 🟧 **주황** — 6번 ARITH_N → A·Z·조건점프 OR 칩 5번
7. ⬛ **검정** — 7번 → GND
8. 🟦 **파랑** — 8번 Z_CLK → 74HC74 Z Flag·MONITOR_MODE 저장칩 3번
9. 🟦 **파랑** — 9번 ← CPU_CLK
10. 🟧 **주황** — 10번 ← Z_EN
11. 🟧 **주황** — 11번 JUMP_PAIR1_N → 점프·주소·읽기 AND 칩 4번
12. 🟧 **주황** — 12번 ← JMP_N
13. 🟧 **주황** — 13번 ← RUN_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-5. 74HC08 점프·주소·읽기 제어 AND 칩

1. 🟧 **주황** — 1번 ← JZ_TAKE_N
2. 🟧 **주황** — 2번 ← JNZ_TAKE_N
3. 🟧 **주황** — 3번 JUMP_PAIR2_N → 같은 칩 5번
4. 🟧 **주황** — 4번 ← JUMP_PAIR1_N
5. 🟧 **주황** — 5번 ← 같은 칩 3번 JUMP_PAIR2_N
6. 🟧 **주황** — 6번 JUMP_ANY_N → PC LOAD·RUN·HLT·Program Read OR 칩 2번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 ADDR_LOW → ALU·SUB·Z·Address·LCD 인버터 9번
9. 🟧 **주황** — 9번 ← 마이크로스텝 디코더 11번 T4_N
10. 🟧 **주황** — 10번 ← 마이크로스텝 디코더 10번 T5_N
11. 🟧 **주황** — 11번 READOP_N → Read·Write·BUS OR 칩 2번
12. 🟧 **주황** — 12번 ← A_EXEC_N
13. 🟧 **주황** — 13번 ← CMP_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-6. 74HC08 RAM 읽기 제어 AND 칩

1. 🟧 **주황** — 1번 ← PROG_READ_N
2. 🟧 **주황** — 2번 ← DATA_READ_N
3. 🟧 **주황** — 3번 RAM_MRD_N → RAM #1~#5의 16번 MRD
4. 🟧 **주황** — 4번 ← PROG_READ_N
5. 🟧 **주황** — 5번 ← LDA_T5_N
6. 🟧 **주황** — 6번 RAM_BUS_READ_N → 같은 칩 9번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 ACCESS_N → IR·T-state·A Enable 인버터 11번
9. 🟧 **주황** — 9번 ← 같은 칩 6번 RAM_BUS_READ_N
10. 🟧 **주황** — 10번 ← STA_T5_N
11. 🟧 **주황** — 11번 RAMVALID_TMP → RAM 버스·A/OUT/ALU AND 칩 1번
12. 🟧 **주황** — 12번 ← RAM 뱅크 디코더 10번 Y5
13. 🟧 **주황** — 13번 ← RAM 뱅크 디코더 9번 Y6
14. 🟥 **빨강** — 14번 → +5V

---

# 6-7. 74HC08 RAM 버스·A/OUT/ALU 제어 AND 칩

1. 🟧 **주황** — 1번 ← RAMVALID_TMP
2. 🟧 **주황** — 2번 ← RAM 뱅크 디코더 7번 Y7
3. 🟧 **주황** — 3번 RAM_VALID → 같은 칩 5번
4. 🟧 **주황** — 4번 ← ACCESS_POS
5. 🟧 **주황** — 5번 ← 같은 칩 3번 RAM_VALID
6. 🟧 **주황** — 6번 RAM_BUS_ENABLE_POS → OUT·ZERO·I/O·PS2·RAM BUS 인버터 13번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 AOUT_TMP1 → 같은 칩 12번
9. 🟧 **주황** — 9번 ← STA_N
10. 🟧 **주황** — 10번 ← OUT_N
11. 🟧 **주황** — 11번 AOUTALU_N → Read·Write·BUS OR 칩 13번
12. 🟧 **주황** — 12번 ← 같은 칩 8번 AOUT_TMP1
13. 🟧 **주황** — 13번 ← ADD_SUB_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-8. 74HC08 키보드·LCD·ACK 제어 AND 칩

1. 🟧 **주황** — 1번 ← I/O 주소 디코더 15번 KEY_STATUS_N
2. 🟧 **주황** — 2번 ← I/O 주소 디코더 14번 KEY_DATA_N
3. 🟧 **주황** — 3번 KEYSEL_N → Boot·Keyboard·LCD BUS OR 칩 5번
4. 🟦 **파랑** — 4번 ← A_CLK
5. 🟧 **주황** — 5번 ← KEY_ACK_COND
6. 🟧 **주황** — 6번 KEY_ACK_PULSE → STA·RAM Write·KEY ACK 인버터 9번
7. ⬛ **검정** — 7번 → GND
8. 🟦 **파랑** — 8번 KEY_CLR_N → 74HC74 KEY_READY·HALT 저장칩 1번, PS/2 비트 카운터 1번
9. 🟦 **파랑** — 9번 ← RESET_N
10. 🟧 **주황** — 10번 ← KEY_ACK_PULSE_N
11. 🟧 **주황** — 11번 LCDSEL_N → Boot·Keyboard·LCD BUS OR 칩 13번
12. 🟧 **주황** — 12번 ← I/O 주소 디코더 13번 LCD_DATA_N
13. 🟧 **주황** — 13번 ← I/O 주소 디코더 12번 LCD_COMMAND_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-9. 74HC08 OUT·LCD·PS/2 제어 AND 칩

1. 🟧 **주황** — 1번 ← OUT_T5_N
2. 🟧 **주황** — 2번 ← LCD_WRITE_N
3. 🟧 **주황** — 3번 OUT_EN_N → OUT·ZERO·I/O·PS2·RAM BUS 인버터 1번
4. 🟦 **파랑** — 4번 ← CPU_CLK
5. 🟧 **주황** — 5번 ← OUT_EN
6. 🟦 **파랑** — 6번 OUT_CLK → 74HC273 출력 레지스터 11번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 LCD_E → LCD E핀
9. 🟦 **파랑** — 9번 ← CPU_CLK
10. 🟧 **주황** — 10번 ← LCD_WRITE
11. ⬜ **흰색** — 11번 HIGHPAIR → PS2·RAM 쓰기 펄스 AND 칩 2번
12. ⬜ **흰색** — 12번 ← PS/2 비트 카운터 11번 QD
13. ⬜ **흰색** — 13번 ← QC_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-10. 74HC08 PS/2·RAM 쓰기 펄스 제어 AND 칩

1. ⬜ **흰색** — 1번 ← LOWPAIR
2. ⬜ **흰색** — 2번 ← HIGHPAIR
3. ⬜ **흰색** — 3번 COUNT11 → 같은 칩 5번
4. 🟦 **파랑** — 4번 ← PS2_INV_CLK
5. ⬜ **흰색** — 5번 ← KEY_READY_N
6. 🟦 **파랑** — 6번 PS2_SAMPLE_CLK → PS/2 Shift Register #1 8번, #2 8번, PS/2 비트 카운터 2번
7. ⬛ **검정** — 7번 → GND
8. 🟦 **파랑** — 8번 FRAME_CLK → 74HC74 KEY_READY·HALT 저장칩 3번
9. 🟦 **파랑** — 9번 ← PS2_POST_CLK
10. ⬜ **흰색** — 10번 ← 같은 칩 3번 COUNT11
11. 🟧 **주황** — 11번 RAM_WRITE_PULSE → STA·RAM Write·KEY ACK 인버터 3번
12. 🟦 **파랑** — 12번 ← CPU_CLK
13. 🟧 **주황** — 13번 ← STA_T5
14. 🟥 **빨강** — 14번 → +5V

---

# 6-11. 74HC08 예비 AND 칩

사용하지 않는 입력은 떠 있게 두지 않는다.

- ⬛ **검정** — 1,2,4,5,9,10,12,13번 입력 → GND
- ⬛ **검정** — 7번 → GND
- 🟥 **빨강** — 14번 → +5V
- — **배선 없음** — 3,6,8,11번 출력

---

# 6-12. 74HC32 확장명령·PC카운트·LDI 제어 OR 칩

1. 🟧 **주황** — 1번 ← EXT_VALID_N
2. 🟧 **주황** — 2번 ← IR2
3. 🟧 **주황** — 3번 EXT_LO_EN_N → 확장 명령 디코더 1번
4. 🟧 **주황** — 4번 ← EXT_VALID_N
5. 🟧 **주황** — 5번 ← IR2_N
6. 🟧 **주황** — 6번 EXT_HI_EN_N → 확장 명령 디코더 15번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 PC_COUNT → PC 하위 카운터 10번 ENT, ALU·SUB·Z·Address·LCD 인버터 11번
9. 🟧 **주황** — 9번 ← T1
10. 🟧 **주황** — 10번 ← T3_BYTE2
11. 🟧 **주황** — 11번 LDI_T3_N → A·IR 클럭 AND 칩 1번
12. 🟧 **주황** — 12번 ← T3_N
13. 🟧 **주황** — 13번 ← LDI_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-13. 74HC32 A·Z·조건점프 제어 OR 칩

1. 🟧 **주황** — 1번 ← T5_N
2. 🟧 **주황** — 2번 ← A_EXEC_N
3. 🟧 **주황** — 3번 T5_AEXEC_N → A·IR 클럭 AND 칩 2번
4. 🟧 **주황** — 4번 ← T5_N
5. 🟧 **주황** — 5번 ← ARITH_N
6. 🟧 **주황** — 6번 Z_EN_N → ALU·SUB·Z·Address·LCD 인버터 5번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 JZ_TAKE_N → 점프·주소·읽기 AND 칩 1번
9. 🟧 **주황** — 9번 ← JZ_N
10. ⬜ **흰색** — 10번 ← Z_N
11. 🟧 **주황** — 11번 JNZ_TAKE_N → 점프·주소·읽기 AND 칩 2번
12. 🟧 **주황** — 12번 ← JNZ_N
13. ⬜ **흰색** — 13번 ← Z
14. 🟥 **빨강** — 14번 → +5V

---

# 6-14. 74HC32 PC LOAD·RUN·HLT·Program Read 제어 OR 칩

1. 🟧 **주황** — 1번 ← T5_N
2. 🟧 **주황** — 2번 ← JUMP_ANY_N
3. 🟧 **주황** — 3번 PC_LOAD_N → PC 하위 카운터 9번 /LOAD, PC 상위 카운터 9번 /LOAD
4. 🟧 **주황** — 4번 ← T5_N
5. 🟧 **주황** — 5번 ← RUN_N
6. 🟧 **주황** — 6번 RUN_T5_N → 74HC74 Z Flag·MONITOR_MODE 저장칩 13번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 HLT_T5_N → 74HC74 KEY_READY·HALT 저장칩 10번
9. 🟧 **주황** — 9번 ← T5_N
10. 🟧 **주황** — 10번 ← HLT_N
11. 🟧 **주황** — 11번 PROG_READ_N → RAM 읽기 AND 칩 1번, 4번
12. ⬜ **흰색** — 12번 ← MONITOR_MODE
13. 🟧 **주황** — 13번 ← PC_COUNT_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-15. 74HC32 Read·Write·BUS 제어 OR 칩

1. 🟧 **주황** — 1번 ← T5_N
2. 🟧 **주황** — 2번 ← READOP_N
3. 🟧 **주황** — 3번 DATA_READ_N → RAM 읽기 AND 칩 2번
4. 🟧 **주황** — 4번 ← STA_N
5. 🟧 **주황** — 5번 ← T5_N
6. 🟧 **주황** — 6번 STA_T5_N → RAM 데이터 버스 드라이버 1번 DIR, RAM 읽기 AND 칩 10번, STA·RAM Write·KEY ACK 인버터 1번, Boot·Keyboard·LCD BUS OR 칩 12번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 LDA_T5_N → RAM 읽기 AND 칩 5번, Boot·Keyboard·LCD BUS OR 칩 4번과 9번
9. 🟧 **주황** — 9번 ← LDA_N
10. 🟧 **주황** — 10번 ← T5_N
11. 🟧 **주황** — 11번 A_ALU_BUS_OE_N → 74HC245 A/ALU 데이터 버스 드라이버 19번 /OE
12. 🟧 **주황** — 12번 ← T5_N
13. 🟧 **주황** — 13번 ← AOUTALU_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-16. 74HC32 Boot·Keyboard·LCD BUS 제어 OR 칩

1. ⬜ **흰색** — 1번 ← MONITOR_N
2. 🟧 **주황** — 2번 ← PC_COUNT_N
3. 🟧 **주황** — 3번 BOOT_ROM_OE_N → 74HC245 Boot ROM 데이터 버스 드라이버 19번 /OE
4. 🟧 **주황** — 4번 ← LDA_T5_N
5. 🟧 **주황** — 5번 ← KEYSEL_N
6. 🟧 **주황** — 6번 KEY_READ_N → 74HC245 키보드 데이터 버스 드라이버 19번 /OE
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 KEY_ACK_COND_N → STA·RAM Write·KEY ACK 인버터 5번
9. 🟧 **주황** — 9번 ← LDA_T5_N
10. 🟧 **주황** — 10번 ← I/O 주소 디코더 14번 KEY_DATA_N
11. 🟧 **주황** — 11번 LCD_WRITE_N → ALU·SUB·Z·Address·LCD 인버터 13번, OUT·LCD·PS2 AND 칩 2번
12. 🟧 **주황** — 12번 ← STA_T5_N
13. 🟧 **주황** — 13번 ← LCDSEL_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-17. 74HC32 OUT·Zero Tree 앞단 OR 칩

1. 🟧 **주황** — 1번 ← OUT_N
2. 🟧 **주황** — 2번 ← T5_N
3. 🟧 **주황** — 3번 OUT_T5_N → OUT·LCD·PS2 AND 칩 1번
4. 🟩 **초록** — 4번 ← ALU bit0
5. 🟩 **초록** — 5번 ← ALU bit1
6. ⬜ **흰색** — 6번 ZERO01 → Zero Tree 뒷단 OR 칩 4번
7. ⬛ **검정** — 7번 → GND
8. ⬜ **흰색** — 8번 ZERO23 → Zero Tree 뒷단 OR 칩 5번
9. 🟩 **초록** — 9번 ← ALU bit2
10. 🟩 **초록** — 10번 ← ALU bit3
11. ⬜ **흰색** — 11번 ZERO45 → Zero Tree 뒷단 OR 칩 9번
12. 🟩 **초록** — 12번 ← ALU bit4
13. 🟩 **초록** — 13번 ← ALU bit5
14. 🟥 **빨강** — 14번 → +5V

---

# 6-18. 74HC32 Zero Tree 뒷단 OR 칩

1. 🟩 **초록** — 1번 ← ALU bit6
2. 🟩 **초록** — 2번 ← ALU bit7
3. ⬜ **흰색** — 3번 ZERO67 → 같은 칩 10번
4. ⬜ **흰색** — 4번 ← ZERO01
5. ⬜ **흰색** — 5번 ← ZERO23
6. ⬜ **흰색** — 6번 ZERO03 → 같은 칩 12번
7. ⬛ **검정** — 7번 → GND
8. ⬜ **흰색** — 8번 ZERO47 → 같은 칩 13번
9. ⬜ **흰색** — 9번 ← ZERO45
10. ⬜ **흰색** — 10번 ← 같은 칩 3번 ZERO67
11. ⬜ **흰색** — 11번 ZERO_ANY → OUT·ZERO·I/O·PS2·RAM BUS 인버터 3번
12. ⬜ **흰색** — 12번 ← ZERO03
13. ⬜ **흰색** — 13번 ← ZERO47
14. 🟥 **빨강** — 14번 → +5V

---

# 6-19. 74HC04 IR·T-state·A Enable 인버터

1. 🟧 **주황** — 1번 ← IR7
2. 🟧 **주황** — 2번 IR7_N → 기본 명령 디코더 15번 /2G
3. 🟧 **주황** — 3번 ← IR2
4. 🟧 **주황** — 4번 IR2_N → 확장명령·PC카운트·LDI OR 칩 5번
5. 🟧 **주황** — 5번 ← T1_N
6. 🟧 **주황** — 6번 T1 → 확장명령·PC카운트·LDI OR 칩 9번, A·IR 클럭 AND 칩 10번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 T3 → CPU 클럭·2바이트 AND 칩 12번
9. 🟧 **주황** — 9번 ← T3_N
10. 🟧 **주황** — 10번 ACCESS_POS → RAM 버스·A/OUT/ALU AND 칩 4번
11. 🟧 **주황** — 11번 ← ACCESS_N
12. 🟧 **주황** — 12번 A_EN → A·IR 클럭 AND 칩 5번
13. 🟧 **주황** — 13번 ← A_EN_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-20. 74HC04 ALU·SUB·Z·Address·LCD 인버터

1. 🟧 **주황** — 1번 ← ADD_SUB_N
2. 🟧 **주황** — 2번 ALU_SEL → A/ALU 선택 MUX 하위칩 1번, 상위칩 1번
3. 🟧 **주황** — 3번 ← SUBCMP_N
4. 🟧 **주황** — 4번 SUB_MODE → 두 74HC86 XOR의 제어입력들과 74HC283 하위 ALU 7번 CIN
5. 🟧 **주황** — 5번 ← Z_EN_N
6. 🟧 **주황** — 6번 Z_EN → SUB·CMP·Z·점프 AND 칩 10번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 ADDR_SEL → 주소 선택 MUX 하위칩 1번, 상위칩 1번
9. 🟧 **주황** — 9번 ← ADDR_LOW
10. 🟧 **주황** — 10번 PC_COUNT_N → PC LOAD·RUN·HLT·Program Read OR 칩 13번, Boot·Keyboard·LCD BUS OR 칩 2번
11. 🟧 **주황** — 11번 ← PC_COUNT
12. 🟧 **주황** — 12번 LCD_WRITE → OUT·LCD·PS2 AND 칩 10번
13. 🟧 **주황** — 13번 ← LCD_WRITE_N
14. 🟥 **빨강** — 14번 → +5V

---

# 6-21. 74HC04 OUT·ZERO·I/O·PS2·RAM BUS 인버터

1. 🟧 **주황** — 1번 ← OUT_EN_N
2. 🟧 **주황** — 2번 OUT_EN → OUT·LCD·PS2 AND 칩 5번
3. ⬜ **흰색** — 3번 ← ZERO_ANY
4. ⬜ **흰색** — 4번 ZERO → 74HC74 Z Flag·MONITOR_MODE 저장칩 2번
5. 🟨 **노랑** — 5번 ← ADDRESS A3
6. 🟨 **노랑** — 6번 A3_N → I/O 주소 디코더 6번
7. ⬛ **검정** — 7번 → GND
8. ⬜ **흰색** — 8번 QC_N → OUT·LCD·PS2 AND 칩 13번
9. ⬜ **흰색** — 9번 ← PS/2 비트 카운터 12번 QC
10. ⬜ **흰색** — 10번 LOWPAIR → PS2·RAM 쓰기 펄스 AND 칩 1번
11. ⬜ **흰색** — 11번 ← LOWPAIR_N
12. 🟧 **주황** — 12번 RAM_BUS_OE_N → 74HC245 RAM 데이터 버스 드라이버 19번 /OE
13. 🟧 **주황** — 13번 ← RAM_BUS_ENABLE_POS
14. 🟥 **빨강** — 14번 → +5V

---

# 6-22. 74HC04 STA·RAM Write·KEY ACK 인버터

1. 🟧 **주황** — 1번 ← STA_T5_N
2. 🟧 **주황** — 2번 STA_T5 → PS2·RAM 쓰기 펄스 AND 칩 13번
3. 🟧 **주황** — 3번 ← RAM_WRITE_PULSE
4. 🟧 **주황** — 4번 RAM_MWR_N → RAM #1~#5의 17번 MWR
5. 🟧 **주황** — 5번 ← KEY_ACK_COND_N
6. 🟧 **주황** — 6번 KEY_ACK_COND → 키보드·LCD·ACK AND 칩 5번
7. ⬛ **검정** — 7번 → GND
8. 🟧 **주황** — 8번 KEY_ACK_PULSE_N → 키보드·LCD·ACK AND 칩 10번
9. 🟧 **주황** — 9번 ← KEY_ACK_PULSE
10. — **배선 없음** — 10번 미사용 출력
11. ⬛ **검정** — 11번 미사용 입력 → GND
12. — **배선 없음** — 12번 미사용 출력
13. ⬛ **검정** — 13번 미사용 입력 → GND
14. 🟥 **빨강** — 14번 → +5V

---

# 6-23. 이 단계 테스트 순서

한꺼번에 CPU를 돌리지 않는다.

1. 각 74HC08 게이트를 수동 HIGH/LOW로 AND 진리표 확인
2. 각 74HC32 게이트를 OR 진리표 확인
3. 각 74HC04를 LOW→HIGH, HIGH→LOW로 확인
4. 🟦 CPU_CLK, MAR_CLK, A_CLK, IR_CLK, Z_CLK가 필요한 조건에서만 생기는지 확인
5. 🟧 RAM_MRD_N, RAM_MWR_N, 각 `/OE`가 동시에 충돌하지 않는지 확인
6. ⬜ ZERO는 ALU=00000000일 때만 HIGH인지 확인

특히 DATA BUS 드라이버의 `/OE`가 둘 이상 동시에 LOW가 되면 안 된다.

## 다음 파일

[07_Flag_BootROM.md](./07_Flag_BootROM.md)