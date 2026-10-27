export function defaultComposeSender(user, currentAccount) {
    if (currentAccount?.email) return currentAccount
    return {...user?.account, email: user?.email, name: user?.name}
}

export function mergeSenderAccounts(...groups) {
    const accounts = new Map()
    for (const account of groups.flat()) {
        if (!account?.email || account.accountId == null) continue
        accounts.set(account.accountId, {...accounts.get(account.accountId), ...account})
    }
    return [...accounts.values()]
}

export function selectComposeSender(form, account) {
    form.accountId = account.accountId
    form.sendEmail = account.email
    form.name = account.name || account.email.split('@')[0]
}

export function sameComposeSender(form, original) {
    return form.accountId === original.accountId && form.name === original.name
}
