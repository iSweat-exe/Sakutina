type DirtyCheck = () => boolean;

let dirtyCheck: DirtyCheck | null = null;

export function setUnsavedChangesGuard(fn: DirtyCheck | null) {
    dirtyCheck = fn;
}

/** Returns false if the user cancelled navigation because of unsaved changes. */
export function confirmNavigation(): boolean {
    if (!dirtyCheck || !dirtyCheck()) return true;
    return window.confirm(
        'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter cette page ?'
    );
}
