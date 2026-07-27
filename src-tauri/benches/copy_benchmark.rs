// Same transitive graph as the lib crate; see lib.rs.
#![allow(clippy::multiple_crate_versions)]

use adb_gui_next_lib::payload::copy_raw_slice;
use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use std::hint::black_box;

/// `copy_raw_slice` now lowers to `memcpy` on every target. The hand-rolled
/// SSE2/AVX2/AVX-512 strategies this benchmark used to compare were removed:
/// on x86_64 they were called without `#[target_feature]` so LLVM could not
/// vectorize them, and on every other target they degraded to a bounds-checked
/// byte-at-a-time loop.
fn bench_copy(c: &mut Criterion) {
    let sizes = [1_024, 65_536, 1_048_576, 16_777_216];

    let mut group = c.benchmark_group("copy");
    for size in sizes {
        let src = vec![0u8; size];
        let mut dst = vec![0u8; size];

        group.throughput(criterion::Throughput::Bytes(size as u64));
        group.bench_with_input(BenchmarkId::new("copy_raw_slice", size), &size, |b, _| {
            b.iter(|| copy_raw_slice(black_box(&mut dst), black_box(&src)));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_copy);
criterion_main!(benches);
