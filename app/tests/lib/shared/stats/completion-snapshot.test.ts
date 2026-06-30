import { describe, expect, it } from 'vitest';
import { applyVisit, buildFiveOhOneSession } from '@lib/shared/games/501';
import {
  applyRoundToState as applyScoreRoundToState,
  buildRoundRecord as buildScoreRoundRecord,
  buildScoreTrainingSession,
} from '@lib/shared/games/score-training';
import {
  applyDartToSession,
  buildSinglesTrainingSession,
  isHit,
} from '@lib/shared/games/singles-training';
import {
  applyRoundToState as applyTenUpOneDownRoundToState,
  buildRoundRecord as buildTenUpOneDownRoundRecord,
  buildTenUpOneDownSession,
} from '@lib/shared/games/ten-up-one-down';
import {
  build501CompletionSnapshot,
  buildScoreTrainingCompletionSnapshot,
  buildSinglesTrainingCompletionSnapshot,
  buildTenUpOneDownCompletionSnapshot,
} from '@lib/shared/stats';

describe('build501CompletionSnapshot', () => {
  it('extracts user visit totals and milestones', () => {
    let session = buildFiveOhOneSession({
      matchMode: 'first-to',
      targetCount: 1,
      unit: 'legs',
      players: [{ id: 'u1', type: 'user', name: 'Levi' }],
    });

    for (const score of [180, 180, 141]) {
      session = applyVisit(session, score);
    }

    const snap = build501CompletionSnapshot(session);
    expect(snap.gameSlug).toBe('501');
    expect(snap.dartsThrown).toBe(9);
    expect(snap.scoringVisits).toBe(3);
    expect(snap.visits180).toBe(2);
    expect(snap.visits100Plus).toBe(3);
  });
});

describe('buildScoreTrainingCompletionSnapshot', () => {
  it('extracts scoring totals and milestones from rounds', () => {
    let session = buildScoreTrainingSession({ endMode: 'rounds', roundCount: 3 });

    for (const score of [60, 120, 140]) {
      const round = buildScoreRoundRecord(
        session.state.currentRound,
        score,
        session.state.currentScore,
      );
      session.roundHistory.push(round);
      session.state = applyScoreRoundToState(session.state, round, session.settings);
    }

    const snap = buildScoreTrainingCompletionSnapshot(session);
    expect(snap.gameSlug).toBe('score-training');
    expect(snap.scoringPoints).toBe(320);
    expect(snap.scoringVisits).toBe(3);
    expect(snap.visits100Plus).toBe(2);
    expect(snap.visits120Plus).toBe(2);
    expect(snap.visits140Plus).toBe(1);
    expect(snap.visits180).toBe(0);
    expect(snap.pointsScored).toBe(0);
    expect(snap.doubleAttempts).toBe(0);
    expect(snap.segmentAttempts).toBe(0);
  });
});

describe('buildTenUpOneDownCompletionSnapshot', () => {
  it('extracts double attempts and hits from round history', () => {
    let session = buildTenUpOneDownSession({ endMode: 'rounds', roundCount: 2 });

    const successRound = buildTenUpOneDownRoundRecord(1, session.state.currentTarget, {
      outcome: 'success',
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    session.roundHistory.push(successRound);
    session.state = applyTenUpOneDownRoundToState(
      session.state,
      successRound,
      session.settings,
    );

    const failureRound = buildTenUpOneDownRoundRecord(2, session.state.currentTarget, {
      outcome: 'failure',
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
    session.roundHistory.push(failureRound);
    session.state = applyTenUpOneDownRoundToState(
      session.state,
      failureRound,
      session.settings,
    );

    const snap = buildTenUpOneDownCompletionSnapshot(session);
    expect(snap.gameSlug).toBe('ten-up-one-down');
    expect(snap.doubleAttempts).toBe(3);
    expect(snap.doubleHits).toBe(1);
    expect(snap.pointsScored).toBe(0);
    expect(snap.scoringVisits).toBe(0);
    expect(snap.segmentHits).toBe(0);
  });
});

describe('buildSinglesTrainingCompletionSnapshot', () => {
  it('extracts segment hit and attempt counts from darts', () => {
    let session = buildSinglesTrainingSession({
      direction: 'low-to-high',
      mode: 'normal',
      scoring: 'traditional',
    });

    session = applyDartToSession(session, { type: 'miss' });
    session = applyDartToSession(session, { type: 'single' });
    session = applyDartToSession(session, { type: 'double' });
    session = applyDartToSession(session, { type: 'miss' });
    session = applyDartToSession(session, { type: 'triple' });

    const expectedHits = session.dartHistory.filter((dart) => isHit(dart.outcome)).length;
    const snap = buildSinglesTrainingCompletionSnapshot(session);

    expect(snap.gameSlug).toBe('singles-training');
    expect(snap.segmentAttempts).toBe(5);
    expect(snap.segmentHits).toBe(expectedHits);
    expect(snap.pointsScored).toBe(0);
    expect(snap.scoringPoints).toBe(0);
    expect(snap.doubleHits).toBe(0);
  });
});
