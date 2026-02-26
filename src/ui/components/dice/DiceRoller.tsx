import { forwardRef, useImperativeHandle, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DiceRoll = require("react-dice-roll").default ?? require("react-dice-roll");

type InternalRef = { rollDice: (value: 1 | 2 | 3 | 4 | 5 | 6) => void };

export type DiceRollerHandle = {
  roll: (value: number) => void;
};

interface DiceRollerProps {
  defaultValue?: number;
  size?: number;
}

export const DiceRoller = forwardRef<DiceRollerHandle, DiceRollerProps>(
  ({ defaultValue = 1, size = 60 }, ref) => {
    const internalRef = useRef<InternalRef>(null);

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
