import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    organization: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md p-6 shadow-xl rounded-2xl">
        <CardContent>
          <h1 className="text-2xl font-bold mb-4 text-center">
            {mode === "login" ? "Prijava" : "Registracija"}
          </h1>

          {/* SOCIAL LOGIN */}
          <div className="space-y-2 mb-4">
            <Button className="w-full">Prijava z Google</Button>
            <Button className="w-full">Prijava z Facebook</Button>
          </div>

          <div className="text-center text-sm text-gray-500 mb-4">ali</div>

          {/* LOGIN */}
          {mode === "login" && (
            <div className="space-y-3">
              <Input
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
              />
              <Input
                type="password"
                name="password"
                placeholder="Geslo"
                value={form.password}
                onChange={handleChange}
              />

              <Button className="w-full">Prijava</Button>

              <p className="text-sm text-center">
                Nimaš računa?{" "}
                <span
                  className="text-blue-500 cursor-pointer"
                  onClick={() => setMode("register")}
                >
                  Registriraj se
                </span>
              </p>
            </div>
          )}

          {/* REGISTER */}
          {mode === "register" && (
            <div className="space-y-3">
              {step === 1 && (
                <>
                  <Input
                    name="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={handleChange}
                  />
                  <Input
                    type="password"
                    name="password"
                    placeholder="Geslo"
                    value={form.password}
                    onChange={handleChange}
                  />

                  <Button className="w-full" onClick={() => setStep(2)}>
                    Nadaljuj
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <Input
                    name="firstName"
                    placeholder="Ime"
                    value={form.firstName}
                    onChange={handleChange}
                  />
                  <Input
                    name="lastName"
                    placeholder="Priimek"
                    value={form.lastName}
                    onChange={handleChange}
                  />
                  <Input
                    name="organization"
                    placeholder="Društvo"
                    value={form.organization}
                    onChange={handleChange}
                  />

                  <Button className="w-full">Registracija</Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setStep(1)}
                  >
                    Nazaj
                  </Button>
                </>
              )}

              <p className="text-sm text-center">
                Že imaš račun?{" "}
                <span
                  className="text-blue-500 cursor-pointer"
                  onClick={() => {
                    setMode("login");
                    setStep(1);
                  }}
                >
                  Prijavi se
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}