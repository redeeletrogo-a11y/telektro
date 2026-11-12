/** Discovery metadata only. No BluetoothDevice object or protocol credentials retained. */
export function compareSuffix(
  name: string | null | undefined,
  suffix: string,
): "match" | "different" | "unknown" {
  if (!/^\d{5}$/.test(suffix) || !name) return "unknown";
  const tail = name.trim().match(/(\d{5})$/)?.[1];
  return !tail ? "unknown" : tail === suffix ? "match" : "different";
}
export function discoveryError(name: string): string {
  if (name === "NotFoundError")
    return "Seleção cancelada ou nenhum aparelho selecionado. Confira se está ligado, anunciando BLE e ao alcance. Não confirma ausência de carregadores.";
  if (name === "SecurityError" || name === "NotAllowedError")
    return "Permissão negada ou bloqueada pelo navegador. Use HTTPS, permita o acesso e tente por um toque no botão.";
  if (name === "NotSupportedError")
    return "Bluetooth indisponível neste ambiente. Confira suporte, adaptador e Bluetooth ligado. A demonstração continua disponível abaixo.";
  return "Não foi possível abrir a busca. Confira Bluetooth ligado, permissões e suporte do navegador. Nenhuma conexão foi feita.";
}
