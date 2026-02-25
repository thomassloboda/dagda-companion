// eslint-disable-next-line @typescript-eslint/no-require-imports
const DiceRoll = require("react-dice-roll").default ?? require("react-dice-roll");

interface DiceRollerProps {
  faces?: number;
  value: number;
  onRoll?: (val: number) => void;
  size?: number;
}

export function DiceRoller({ faces = 6, value, onRoll, size = 60 }: DiceRollerProps) {
  return (
    <DiceRoll
      cheatValue={value}
      size={size}
      facesCount={faces}
      onRoll={onRoll}
      rollingTime={600}
    />
  );
}
