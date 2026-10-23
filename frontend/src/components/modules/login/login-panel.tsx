export function LoginPanelCard() {
    return (
        <aside className="relative isolate flex h-full w-full flex-col overflow-hidden bg-[#102E2F] p-6 text-white lg:p-8">
            {/* Background illustration — large, overlaps the text */}
            <img
                src="/images/login-spices.png"
                alt="Noodles, garlic, chili peppers, herbs, spices etc."
                className="pointer-events-none absolute inset-x-0 bottom-2 -z-10 h-[75%] w-full origin-bottom scale-110 object-contain object-bottom lg:bottom-3"
            />

            {/* Gradient so text stays readable over the image */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#102E2F] via-[#102E2F]/60 to-[#102E2F]/90"
            />

            {/* Logo */}
            <div className="flex shrink-0 items-center gap-3">
                <img
                    src="/images/kffLogo.png"
                    alt="KFF logo"
                    className="h-12 w-auto shrink-0 object-contain lg:h-14"
                />
            </div>

            {/* Heading and description */}
            <div className="mt-5 shrink-0">
                <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-[#9AB88D]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9AB88D]" />
                    YOUR OPERATIONS, CONNECTED
                </p>

                <h2 className="mt-3 text-2xl font-semibold leading-[1.15] tracking-tight drop-shadow-md lg:text-3xl">
                    Total control.
                    <br />
                    Seamless <span className="text-[#A7CD78]">flow.</span>
                </h2>

                <p className="mt-3 max-w-xs text-sm leading-6 text-[#C3D2C8] drop-shadow">
                    From purchasing to inventory, keep every part of your
                    operation in sync.
                </p>
            </div>

            {/* Spacer pushes footer to the bottom */}
            <div className="flex-1" />

            {/* Footer */}
            <div className="flex shrink-0 items-center gap-2 border-t border-white/15 pt-4 text-xs leading-5 text-[#C3D2C8]">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                >
                    <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
                    <path d="m8 12 3 3 5-6" />
                </svg>

                <span>One workspace. Every part of your operation.</span>
            </div>
        </aside>
    );
}