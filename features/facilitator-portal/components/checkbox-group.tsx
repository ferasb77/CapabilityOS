function CheckboxGroup({
  name,
  options,
  defaultValue = [],
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm text-ivory">
          <input
            type="checkbox"
            name={name}
            value={option}
            defaultChecked={defaultValue.includes(option)}
            className="size-4 rounded border-input accent-gold"
          />
          {option}
        </label>
      ))}
    </div>
  );
}

export { CheckboxGroup };
