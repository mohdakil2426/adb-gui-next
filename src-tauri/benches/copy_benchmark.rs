use adb_gui_next_lib::payload::{copy_raw_slice, detect_copy_strategy};
use criterion::{BenchmarkId, Criterion, black_box, criterion_group, criterion_main};

fn bench_copy_strategies(c: &mut Criterion) {
    let sizes = [1_024, 65_536, 1_048_576, 16_777_216];
    let strategy = detect_copy_strategy();

    let mut group = c.benchmark_group("copy");
    for size in sizes {
        let src = vec![0u8; size];
        let mut dst = vec![0u8; size];

        group.bench_with_input(BenchmarkId::new(format!("{:?}", strategy), size), &size, |b, _| {
            b.iter(|| copy_raw_slice(black_box(&mut dst), black_box(&src)))
        });
    }
    group.finish();
}

criterion_group!(benches, bench_copy_strategies);
criterion_main!(benches);
