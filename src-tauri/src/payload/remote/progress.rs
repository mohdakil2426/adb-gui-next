//! Shared emission budget for `payload:progress` events.
//!
//! Remote extraction used to emit one Tauri event per install operation (and one
//! per 256 KiB chunk on the factory path) — 2,000 to 16,000 IPC messages for a
//! single extraction, each one a JSON allocation plus a frontend state update.
//!
//! [`ProgressThrottle`] caps that at [`MAX_EVENTS_PER_SEC`] using a single
//! `AtomicU64`, so parallel rayon workers share **one** budget instead of one
//! each. Terminal events (a partition finishing, a download completing) bypass
//! the budget and are always emitted.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// Target upper bound on emitted progress events per second, across all workers.
pub const MAX_EVENTS_PER_SEC: u64 = 4;

const MIN_INTERVAL_MS: u64 = 1000 / MAX_EVENTS_PER_SEC;

/// Shared, lock-free progress emission budget.
pub struct ProgressThrottle {
    start: Instant,
    /// Milliseconds since `start` of the last emission, **plus one**.
    /// `0` means "nothing emitted yet" so the first update is never swallowed.
    last_emit: AtomicU64,
}

impl ProgressThrottle {
    pub fn new() -> Self {
        Self { start: Instant::now(), last_emit: AtomicU64::new(0) }
    }

    /// Returns `true` when the caller may emit now.
    ///
    /// `force` must be set for terminal events (partition completed, download
    /// finished): those always emit, regardless of the remaining budget.
    pub fn should_emit(&self, force: bool) -> bool {
        let now = u64::try_from(self.start.elapsed().as_millis()).unwrap_or(u64::MAX);
        let stamp = now.saturating_add(1);

        if force {
            self.last_emit.store(stamp, Ordering::Relaxed);
            return true;
        }

        let mut last = self.last_emit.load(Ordering::Relaxed);
        loop {
            if last != 0 && now.saturating_sub(last - 1) < MIN_INTERVAL_MS {
                return false;
            }
            match self.last_emit.compare_exchange_weak(
                last,
                stamp,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => return true,
                Err(observed) => last = observed,
            }
        }
    }
}

impl Default for ProgressThrottle {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_update_is_always_emitted() {
        let throttle = ProgressThrottle::new();
        assert!(throttle.should_emit(false));
    }

    #[test]
    fn back_to_back_updates_are_throttled() {
        let throttle = ProgressThrottle::new();
        assert!(throttle.should_emit(false));
        for _ in 0..1000 {
            assert!(!throttle.should_emit(false), "budget must suppress bursts");
        }
    }

    #[test]
    fn terminal_events_bypass_the_budget() {
        let throttle = ProgressThrottle::new();
        assert!(throttle.should_emit(false));
        assert!(!throttle.should_emit(false));
        assert!(throttle.should_emit(true), "completed events must always emit");
    }

    #[test]
    fn budget_reopens_after_the_interval() {
        let throttle = ProgressThrottle::new();
        assert!(throttle.should_emit(false));
        std::thread::sleep(std::time::Duration::from_millis(MIN_INTERVAL_MS + 20));
        assert!(throttle.should_emit(false));
    }
}
