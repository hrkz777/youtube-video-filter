export async function persistOptimisticSetting({ persist, changes, onFailure }) {
  try {
    await persist(changes);
    return true;
  } catch (error) {
    onFailure(error);
    return false;
  }
}
