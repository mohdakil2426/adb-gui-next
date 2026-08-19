//! Incremental / delta OTA engine, source image resolution, and differential algorithms.

pub mod engine;
pub mod source_copy;
pub mod source_matcher;

pub use engine::{DeltaEngine, Extent, MAX_OPERATION_SIZE};
pub use source_copy::source_copy;
pub use source_matcher::SourceMatcher;
