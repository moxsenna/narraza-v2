/**
 * ProjectProgressView reducer — single source for dashboard CTA, redirect, chips.
 *
 * Computes the project progress state from canon data, not from UI state.
 * No fake "writing" without actual job/prose data.
 *
 * Single reducer that outputs:
 * - Current phase (for redirect and sidebar highlighting)
 * - Dashboard CTA (what the user should do next)
 * - Progress chips (completed steps)
 *
 * Matrix: progress-view
 */

export type ProjectPhase =
  | 'intake'
  | 'concepts'
  | 'foundation'
  | 'characters'
  | 'outline'
  | 'writing'
  | 'complete';

export interface ProgressChip {
  label: string;
  phase: ProjectPhase;
  completed: boolean;
  active: boolean;
}

export interface DashboardCta {
  /** Human-readable call to action. */
  label: string;
  /** Route path to navigate to. */
  route: string;
  /** Icon name or null. */
  icon: string | null;
  /** Priority for ordering CTAs. Lower = more important. */
  priority: number;
}

export interface ProjectProgressViewInput {
  /** Project has had intake extraction completed. */
  hasIntake: boolean;
  /** Foundation status. */
  foundationStatus: 'none' | 'draft' | 'locked';
  /** Whether characters exist (even if soft-deleted). */
  hasCharacters: boolean;
  /** Number of chapters in the outline. */
  chapterCount: number;
  /** Whether at least one beat has an accepted prose version. */
  hasAcceptedProse: boolean;
  /** Whether there is an active generation job. */
  hasActiveJob: boolean;
  /** Whether there is a working draft for any beat. */
  hasWorkingDraft: boolean;
}

export interface ProjectProgressView {
  /** Current phase for routing/redirect. */
  currentPhase: ProjectPhase;
  /** Dashboard CTA (most important action). */
  primaryCta: DashboardCta;
  /** Secondary CTAs (up to 2). */
  secondaryCtas: DashboardCta[];
  /** Progress chips for sidebar. */
  chips: ProgressChip[];
  /** Overall completion percentage (0-100). */
  completionPercent: number;
}

/**
 * Compute the project progress view from canon data.
 */
export function computeProjectProgress(
  input: ProjectProgressViewInput,
): ProjectProgressView {
  const {
    hasIntake,
    foundationStatus,
    hasCharacters,
    chapterCount,
    hasAcceptedProse,
    hasActiveJob,
    hasWorkingDraft,
  } = input;

  // Determine current phase
  let currentPhase: ProjectPhase;
  if (!hasIntake) {
    currentPhase = 'intake';
  } else if (foundationStatus === 'none') {
    currentPhase = 'concepts';
  } else if (foundationStatus === 'draft') {
    currentPhase = 'foundation';
  } else if (!hasCharacters) {
    currentPhase = 'characters';
  } else if (chapterCount === 0) {
    currentPhase = 'outline';
  } else if (hasActiveJob || hasWorkingDraft) {
    currentPhase = 'writing';
  } else if (hasAcceptedProse) {
    currentPhase = 'complete';
  } else {
    currentPhase = 'writing';
  }

  // Build chips
  const chips: ProgressChip[] = [
    {
      label: 'Intake',
      phase: 'intake',
      completed: hasIntake,
      active: currentPhase === 'intake',
    },
    {
      label: 'Konsep',
      phase: 'concepts',
      completed: foundationStatus !== 'none',
      active: currentPhase === 'concepts',
    },
    {
      label: 'Fondasi',
      phase: 'foundation',
      completed: foundationStatus === 'locked',
      active: currentPhase === 'foundation',
    },
    {
      label: 'Karakter',
      phase: 'characters',
      completed: hasCharacters,
      active: currentPhase === 'characters',
    },
    {
      label: 'Outline',
      phase: 'outline',
      completed: chapterCount > 0,
      active: currentPhase === 'outline',
    },
    {
      label: 'Menulis',
      phase: 'writing',
      completed: hasAcceptedProse,
      active: currentPhase === 'writing',
    },
  ];

  // Compute primary CTA
  let primaryCta: DashboardCta;
  switch (currentPhase) {
    case 'intake':
      primaryCta = {
        label: 'Mulai Ekstrak Cerita',
        route: '/projects/%id%/intake',
        icon: 'sparkles',
        priority: 1,
      };
      break;
    case 'concepts':
      primaryCta = {
        label: 'Pilih Konsep Cerita',
        route: '/projects/%id%/concepts',
        icon: 'lightbulb',
        priority: 1,
      };
      break;
    case 'foundation':
      primaryCta = {
        label: 'Lengkapi Fondasi',
        route: '/projects/%id%/foundation',
        icon: 'book-open',
        priority: 1,
      };
      break;
    case 'characters':
      primaryCta = {
        label: 'Tambah Karakter',
        route: '/projects/%id%/characters',
        icon: 'users',
        priority: 1,
      };
      break;
    case 'outline':
      primaryCta = {
        label: 'Buat Outline',
        route: '/projects/%id%/outline',
        icon: 'list',
        priority: 1,
      };
      break;
    case 'writing':
      if (hasActiveJob) {
        primaryCta = {
          label: 'Lihat Proses Menulis',
          route: '/projects/%id%/write',
          icon: 'pen-tool',
          priority: 1,
        };
      } else if (hasWorkingDraft) {
        primaryCta = {
          label: 'Lanjutkan Menulis',
          route: '/projects/%id%/write',
          icon: 'pen-tool',
          priority: 1,
        };
      } else {
        primaryCta = {
          label: 'Mulai Menulis',
          route: '/projects/%id%/write',
          icon: 'pen-tool',
          priority: 1,
        };
      }
      break;
    case 'complete':
      primaryCta = {
        label: 'Baca Cerita',
        route: '/projects/%id%/read',
        icon: 'book-open',
        priority: 1,
      };
      break;
  }

  // Secondary CTAs
  const secondaryCtas: DashboardCta[] = [];

  if (currentPhase !== 'intake' && !hasIntake) {
    secondaryCtas.push({
      label: 'Ekstrak Cerita',
      route: '/projects/%id%/intake',
      icon: 'sparkles',
      priority: 2,
    });
  }

  if (
    foundationStatus === 'draft' &&
    currentPhase !== 'foundation'
  ) {
    secondaryCtas.push({
      label: 'Lengkapi Fondasi',
      route: '/projects/%id%/foundation',
      icon: 'book-open',
      priority: 3,
    });
  }

  if (chapterCount > 0 && currentPhase !== 'writing' && currentPhase !== 'complete') {
    secondaryCtas.push({
      label: 'Lanjut Menulis',
      route: '/projects/%id%/write',
      icon: 'pen-tool',
      priority: 4,
    });
  }

  // Completion percentage
  const steps = [
    hasIntake ? 1 : 0,
    foundationStatus === 'locked' ? 1 : foundationStatus === 'draft' ? 0.5 : 0,
    hasCharacters ? 1 : 0,
    chapterCount > 0 ? 1 : 0,
    hasAcceptedProse ? 1 : 0,
  ];
  const completionPercent = Math.round(
    (steps.reduce((a, b) => a + b, 0) / steps.length) * 100,
  );

  return {
    currentPhase,
    primaryCta,
    secondaryCtas,
    chips,
    completionPercent,
  };
}
