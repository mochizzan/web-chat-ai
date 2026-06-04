import Image from 'next/image';

export function AuthHeader() {
  return (
    <div className="px-8 pt-8 pb-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
        <Image src="/logo.png" alt="MI-Labs Logo" width={28} height={28} className="object-contain" />
      </div>
      <h1 className="text-2xl font-bold text-foreground tracking-tight">
        MI-Labs Chat
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Masuk ke akun Anda untuk memulai
      </p>
    </div>
  );
}