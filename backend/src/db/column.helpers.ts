import * as t from "drizzle-orm/pg-core";

export const auditFields = {
    createdBy: t.integer("created_by"),

    createdAt: t
        .timestamp("created_at", {
            mode: "date",
            withTimezone: true,
        })
        .defaultNow()
        .notNull(),

    updatedBy: t.integer("updated_by"),

    updatedAt: t
        .timestamp("updated_at", {
            mode: "date",
            withTimezone: true,
        })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
};