/** Export visible business values without spreadsheet formula execution. */
export function downloadCsv(filename: string, rows: string[][]) {
    const escape = (value: string) =>
        '"' + (/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"'
    const url = URL.createObjectURL(
        new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
            type: "text/csv;charset=utf-8;",
        }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
