"use client"

import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Toast } from "@base-ui/react/toast"
import { apiRequest, ApiError } from "@/lib/api-request"
import { SESSION_QUERY_KEY, useSession } from "@/hooks/use-session"
import {
    customerSchema,
    toCustomerInput,
    type Customer,
    type CreateCustomerInput,
    type UpdateCustomerInput,
    type CustomerFormValues,
} from "@/components/modules/customers/customer.schema"

const CUSTOMERS_PATH = "/customers"

function parseCustomer(data: unknown): Customer {
    const result = customerSchema.safeParse(data)
    if (!result.success) throw new Error("The customer API returned an invalid customer record.")
    return result.data
}

export async function getCustomers(signal?: AbortSignal): Promise<Customer[]> {
    const result = customerSchema.array().safeParse(await apiRequest(CUSTOMERS_PATH, { signal }))
    if (!result.success) throw new Error("The customer API returned an invalid customer list.")
    return result.data
}

export async function getCustomer(customerId: number, signal?: AbortSignal): Promise<Customer> {
    return parseCustomer(await apiRequest(`${CUSTOMERS_PATH}/${customerId}`, { signal }))
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
    return parseCustomer(
        await apiRequest(CUSTOMERS_PATH, { method: "POST", body: JSON.stringify(input) }),
    )
}

export async function updateCustomer(
    customerId: number,
    input: UpdateCustomerInput,
): Promise<Customer> {
    return parseCustomer(
        await apiRequest(`${CUSTOMERS_PATH}/${customerId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    )
}

export const CUSTOMERS_QUERY_KEY = ["customers"] as const
const EMPTY_CUSTOMERS: Customer[] = []

export function useCustomers() {
    const session = useSession()
    const client = useQueryClient()
    const { add: showToast } = Toast.useToastManager()
    const canManage = session.data?.permissions.canManageInventory === true
    const queryKey = [...CUSTOMERS_QUERY_KEY, session.data?.userId]
    const customersQuery = useQuery({
        queryKey,
        queryFn: ({ signal }) => getCustomers(signal),
        enabled: Boolean(session.data),
    })
    const [formOpen, setFormOpen] = useState(false)
    const [formRequested, setFormRequested] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
    const [deactivatingCustomer, setDeactivatingCustomer] = useState<Customer | null>(null)
    // Also guard the interval before React renders the pending mutation state.
    const writePending = useRef(false)

    function cacheCustomer(saved: Customer) {
        client.setQueryData<Customer[]>(queryKey, (current = []) =>
            current.some((customer) => customer.customerId === saved.customerId)
                ? current.map((customer) =>
                      customer.customerId === saved.customerId ? saved : customer,
                  )
                : [...current, saved],
        )
        void client.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
        for (const key of [
            "sales-order-options",
            "delivery-order-options",
            "sales-orders",
            "delivery-orders",
        ])
            void client.invalidateQueries({ queryKey: [key] })
    }

    function mutationError(error: Error) {
        if (error instanceof ApiError && error.status === 403)
            void client.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
        showToast({
            type: "error",
            title: "Unable to update customers",
            description: error.message,
        })
    }

    const save = useMutation({
        mutationFn: ({
            values,
            customer,
        }: {
            values: CustomerFormValues
            customer: Customer | null
        }) => {
            if (!canManage) throw new Error("Your role does not allow editing customers.")
            const input = toCustomerInput(values)
            return customer ? updateCustomer(customer.customerId, input) : createCustomer(input)
        },
        onSuccess: (saved, { customer }) => {
            cacheCustomer(saved)
            showToast({
                type: "success",
                title: customer ? "Customer updated." : "Customer added.",
            })
        },
        onError: mutationError,
    })

    const changeStatus = useMutation({
        mutationFn: ({ customer, isActive }: { customer: Customer; isActive: boolean }) => {
            if (!canManage) throw new Error("Your role does not allow editing customers.")
            return updateCustomer(customer.customerId, { isActive })
        },
        onSuccess: (saved) => {
            cacheCustomer(saved)
            setDeactivatingCustomer(null)
            showToast({
                type: "success",
                title: saved.isActive ? "Customer reactivated." : "Customer deactivated.",
            })
        },
        onError: mutationError,
    })

    const { reset: resetSave, mutateAsync: saveCustomer } = save
    const { reset: resetStatus, mutateAsync: changeCustomerStatus } = changeStatus

    const openAdd = useCallback(() => {
        if (!canManage || writePending.current) return
        resetSave()
        setEditingCustomer(null)
        setFormRequested(true)
        setFormOpen(true)
    }, [canManage, resetSave])

    const openEdit = useCallback(
        (customer: Customer) => {
            if (!canManage || writePending.current) return
            resetSave()
            setEditingCustomer(customer)
            setFormRequested(true)
            setFormOpen(true)
        },
        [canManage, resetSave],
    )

    const openDeactivate = useCallback(
        (customer: Customer) => {
            if (!canManage || writePending.current) return
            resetStatus()
            setDeactivatingCustomer(customer)
        },
        [canManage, resetStatus],
    )

    const handleSave = useCallback(
        async (values: CustomerFormValues, customer: Customer | null) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await saveCustomer({ values, customer })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [saveCustomer],
    )

    const handleActivate = useCallback(
        async (customer: Customer) => {
            if (writePending.current) return false
            writePending.current = true
            try {
                await changeCustomerStatus({ customer, isActive: true })
                return true
            } catch {
                return false
            } finally {
                writePending.current = false
            }
        },
        [changeCustomerStatus],
    )

    const handleDeactivate = useCallback(async () => {
        if (writePending.current || !deactivatingCustomer) return
        writePending.current = true
        try {
            await changeCustomerStatus({ customer: deactivatingCustomer, isActive: false })
        } catch {
            // Keep the confirmation open so the failed change can be retried.
        } finally {
            writePending.current = false
        }
    }, [changeCustomerStatus, deactivatingCustomer])

    const loadStatus = session.isPending
        ? "loading"
        : session.data === undefined
          ? "error"
          : !session.data
            ? "signed-out"
            : customersQuery.data !== undefined
              ? "ready"
              : customersQuery.isError
                ? "error"
                : "loading"

    return {
        customers: customersQuery.data ?? EMPTY_CUSTOMERS,
        canManage,
        loadStatus,
        loadError: customersQuery.error ?? session.error,
        formOpen,
        setFormOpen,
        formRequested,
        editingCustomer,
        deactivatingCustomer,
        setDeactivatingCustomer,
        openAdd,
        openEdit,
        openDeactivate,
        handleSave,
        handleActivate,
        handleDeactivate,
        isSaving: save.isPending,
        isDeactivating: changeStatus.isPending && changeStatus.variables?.isActive === false,
        isUpdating: save.isPending || changeStatus.isPending,
        saveError: save.error?.message ?? null,
        deactivateError: changeStatus.error?.message ?? null,
        isFetching: session.isFetching || customersQuery.isFetching,
        retry: () => {
            void session.refetch()
            if (session.data) void customersQuery.refetch()
        },
    }
}
