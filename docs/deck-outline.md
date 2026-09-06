# Deck outline — 13 slides (per hackathon FAQ's required list)

1. Title + one-line pitch
2. The problem — persona: an organiser of a 500-seat event burned by
   overbooking and a site that died at open
3. Assumed functional features and why we chose those *(required)*
4. The one design principle — never do seat math on the request path
5. Architecture diagram *(required)*
6. Sequence diagram — contended registration *(required)*
7. Correctness — SQS FIFO message groups give one writer per event
8. Adaptive UX — the three-rung ladder
9. Surge Story — screenshot of the annotated timeline
10. Trade-off analysis *(required — the most heavily graded slide)*
11. Results — the measured numbers from A
12. What we deliberately excluded, and why
13. Known limits — the reconciler ceiling and how we'd shard it
