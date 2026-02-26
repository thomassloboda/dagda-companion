import { forwardRef, useImperativeHandle, useRef } from "react";
import DiceRoll from "react-dice-roll";

export type DiceRollerHandle = {
  roll: (value: number) => void;
};

interface DiceRollerProps {
  defaultValue?: number;
  size?: number;
}

export const DiceRoller = forwardRef<DiceRollerHandle, DiceRollerProps>(
  ({ defaultValue = 1, size = 60 }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      roll(value: number) {
        internalRef.current?.rollDice(value as 1 | 2 | 3 | 4 | 5 | 6);
      },
    }));

    return (
      <DiceRoll
        ref={internalRef}
        defaultValue={defaultValue as 1 | 2 | 3 | 4 | 5 | 6}
        size={size}
        rollingTime={600}
      />
    );
  },
);

DiceRoller.displayName = "DiceRoller";
