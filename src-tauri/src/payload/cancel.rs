//! Graceful cancellation token for extraction abort.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self { cancelled: Arc::new(AtomicBool::new(false)) }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    pub fn check(&self) -> Result<(), anyhow::Error> {
        if self.is_cancelled() {
            anyhow::bail!("extraction cancelled by user");
        }
        Ok(())
    }
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}
