# Make Computer

MAKECOMPUTER/8 — 외부 MCU 없이 동작하는 8비트 브레드보드 컴퓨터 제작 프로젝트입니다.

## 제작 문서

- [컴퓨터만들기.md](./컴퓨터만들기.md) — 최종 구조, 메모리 맵, 모든 IC 핀 배선, 점퍼선 색상 규칙
- [단계별 만들기](./단계별%20만들기/) — 초보자용 실제 제작 순서, IC별 배선과 단계별 테스트 방법

처음 만드는 경우에는 **`단계별 만들기/README.md`부터 시작**하고, 정확한 최종 핀 연결을 확인할 때 `컴퓨터만들기.md`를 함께 참고합니다.

## 점퍼선 색상

- 빨강: POWER +5V
- 검정: GND
- 초록: DATA
- 노랑: ADDRESS
- 파랑: CLOCK / RESET
- 주황: CONTROL
- 흰색: STATUS / FLAG / SPECIAL

## 웹 페이지

https://hwanghj09.github.io/makecomputer/

과거 설계 Markdown 문서는 `컴퓨터만들기.md`로 통합했습니다. 이전 버전은 Git history에서 확인할 수 있습니다.
