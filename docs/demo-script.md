# Demo script

Print it. Rehearse alone at 04:00 against the deployed system, then twice with
everyone at 09:00.

```
0:00  A creates an event, 500 seats, "Opens in 30s". Show the countdown.
0:30  Registration opens. D registers on a phone -> Confirmed in under a second.
0:45  A starts k6 at 5,000 VUs.
1:00  Mode badge flips Normal -> High demand. Queue positions appear.
1:15  Point at the invariant panel -- green, holding, under full load.
1:30  A presses "Kill email provider". Breaker opens on the timeline.
1:50  A presses "Restore". Queued confirmations drain.
2:10  Traffic stops. Scale-in appears on the instance chart.
2:30  Scroll the Surge Story timeline top to bottom and read it out.
3:00  Close on the stat tiles: accepted N, rejected 0, overbooked 0, cost $X.
```

Closing line:

> "Most teams will tell you their platform stayed up. We can show you exactly
> what it did, second by second, and prove it never sold the same seat twice."
