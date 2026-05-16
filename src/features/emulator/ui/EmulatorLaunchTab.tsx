import { AlertTriangle, Play } from 'lucide-react';
import { useReducer } from 'react';
import type { backend } from '@/desktop/models';
import { LoadingButton } from '@/shared/components/LoadingButton';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';

type State = {
  wipeData: boolean;
  writableSystem: boolean;
  coldBoot: boolean;
  noSnapshotLoad: boolean;
  noSnapshotSave: boolean;
  noBootAnim: boolean;
  confirmWipeData: boolean;
  confirmWritableSystem: boolean;
};

type Action =
  | { type: 'SET_WIPE_DATA'; payload: boolean }
  | { type: 'SET_WRITABLE_SYSTEM'; payload: boolean }
  | { type: 'SET_COLD_BOOT'; payload: boolean }
  | { type: 'SET_NO_SNAPSHOT_LOAD'; payload: boolean }
  | { type: 'SET_NO_SNAPSHOT_SAVE'; payload: boolean }
  | { type: 'SET_NO_BOOT_ANIM'; payload: boolean }
  | { type: 'SET_CONFIRM_WIPE_DATA'; payload: boolean }
  | { type: 'SET_CONFIRM_WRITABLE_SYSTEM'; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_WIPE_DATA':
      return { ...state, wipeData: action.payload };
    case 'SET_WRITABLE_SYSTEM':
      return { ...state, writableSystem: action.payload };
    case 'SET_COLD_BOOT':
      return { ...state, coldBoot: action.payload };
    case 'SET_NO_SNAPSHOT_LOAD':
      return { ...state, noSnapshotLoad: action.payload };
    case 'SET_NO_SNAPSHOT_SAVE':
      return { ...state, noSnapshotSave: action.payload };
    case 'SET_NO_BOOT_ANIM':
      return { ...state, noBootAnim: action.payload };
    case 'SET_CONFIRM_WIPE_DATA':
      return { ...state, confirmWipeData: action.payload };
    case 'SET_CONFIRM_WRITABLE_SYSTEM':
      return { ...state, confirmWritableSystem: action.payload };
    default:
      return state;
  }
}

const initialState: State = {
  wipeData: false,
  writableSystem: false,
  coldBoot: false,
  noSnapshotLoad: false,
  noSnapshotSave: false,
  noBootAnim: false,
  confirmWipeData: false,
  confirmWritableSystem: false,
};

interface EmulatorLaunchTabProps {
  avd: backend.AvdSummary | null;
  isLaunching: boolean;
  onLaunch: (options: backend.EmulatorLaunchOptions) => Promise<void>;
}

export function EmulatorLaunchTab({ avd, isLaunching, onLaunch }: EmulatorLaunchTabProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const destructiveBlocked =
    (state.wipeData && !state.confirmWipeData) ||
    (state.writableSystem && !state.confirmWritableSystem);

  if (!avd) {
    return (
      <p className="py-4 text-muted-foreground text-sm">
        Select an AVD to configure advanced launch options.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: 'coldBoot',
              label: 'Cold boot',
              value: state.coldBoot,
              action: 'SET_COLD_BOOT' as const,
            },
            {
              id: 'noSnapLoad',
              label: 'Skip snapshot load',
              value: state.noSnapshotLoad,
              action: 'SET_NO_SNAPSHOT_LOAD' as const,
            },
            {
              id: 'noSnapSave',
              label: 'Skip snapshot save',
              value: state.noSnapshotSave,
              action: 'SET_NO_SNAPSHOT_SAVE' as const,
            },
            {
              id: 'noBootAnim',
              label: 'Disable boot animation',
              value: state.noBootAnim,
              action: 'SET_NO_BOOT_ANIM' as const,
            },
            {
              id: 'writableSystem',
              label: 'Writable system',
              value: state.writableSystem,
              action: 'SET_WRITABLE_SYSTEM' as const,
            },
            {
              id: 'wipeData',
              label: 'Wipe user data',
              value: state.wipeData,
              action: 'SET_WIPE_DATA' as const,
            },
          ] as const
        ).map((opt) => (
          <Label className="flex items-center gap-2.5 text-sm" key={opt.id}>
            <Switch
              checked={opt.value}
              id={`launch-opt-${opt.id}`}
              onCheckedChange={(checked) => {
                dispatch({ type: opt.action, payload: checked });
              }}
            />
            {opt.label}
          </Label>
        ))}
      </div>

      {state.wipeData || state.writableSystem ? (
        <Alert className="border-warning/30 bg-warning/10 text-warning-foreground">
          <AlertTriangle />
          <AlertTitle>Safety confirmation required</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">
            Acknowledge the risks before launching with destructive flags.
          </AlertDescription>
          <div className="col-start-2 mt-2 flex flex-col gap-3">
            {state.wipeData ? (
              <Label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={state.confirmWipeData}
                  onCheckedChange={(checked: boolean) => {
                    dispatch({ type: 'SET_CONFIRM_WIPE_DATA', payload: checked });
                  }}
                />
                I understand wiping data resets this emulator profile.
              </Label>
            ) : null}
            {state.writableSystem ? (
              <Label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={state.confirmWritableSystem}
                  onCheckedChange={(checked: boolean) => {
                    dispatch({ type: 'SET_CONFIRM_WRITABLE_SYSTEM', payload: checked });
                  }}
                />
                I understand writable-system can leave this AVD in a modified state.
              </Label>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <LoadingButton
        disabled={destructiveBlocked}
        icon={<Play className="size-4" />}
        isLoading={isLaunching}
        loadingLabel="Launching..."
        onClick={() =>
          void onLaunch({
            wipeData: state.wipeData,
            writableSystem: state.writableSystem,
            coldBoot: state.coldBoot,
            noSnapshotLoad: state.noSnapshotLoad,
            noSnapshotSave: state.noSnapshotSave,
            noBootAnim: state.noBootAnim,
          })
        }
      >
        Launch with these options
      </LoadingButton>
    </div>
  );
}
