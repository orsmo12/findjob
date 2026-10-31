"""מריץ את כל הבדיקות בלי pytest:  python tests/run_all.py"""
import sys, importlib.util, traceback
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
ok = fail = 0
for f in sorted((root / "tests").glob("test_*.py")):
    spec = importlib.util.spec_from_file_location(f.stem, f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    for n in sorted(dir(m)):
        if n.startswith("test_"):
            try:
                getattr(m, n)(); ok += 1; print("✓", f.stem, n)
            except Exception:
                fail += 1; print("✗", f.stem, n); traceback.print_exc()
print(f"\n{ok} עברו, {fail} נכשלו"); sys.exit(1 if fail else 0)
