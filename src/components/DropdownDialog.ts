export default interface DropdownDialog<T, NullableRow extends boolean = false> {
	open: boolean;
	setOpen: (open: boolean) => void;
	row: NullableRow extends false ? T : T | null;
}
