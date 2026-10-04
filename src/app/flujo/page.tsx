import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Flujo",
};

function Step({
  n,
  title,
  children,
  href,
  hrefLabel,
}: {
  n: string;
  title: string;
  children: ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <li className="grid gap-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
            {n}
          </span>
          <h3 className="font-medium">{title}</h3>
        </div>
        {href ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={href} />}
          >
            {hrefLabel ?? "Abrir"}
          </Button>
        ) : null}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </li>
  );
}

function Arrow() {
  return (
    <p className="px-1 text-center text-xs text-muted-foreground" aria-hidden>
      ↓
    </p>
  );
}

function Tension({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      {children}
    </p>
  );
}

export default async function WorkflowPage() {
  await requireUser("/flujo");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Flujo actual
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Esto es lo que la app hace hoy, no el flujo ideal. Hay dos maneras de
          meter un perfil y no están unificadas. Sirve para decidir qué
          recortamos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>En una frase</CardTitle>
          <CardDescription>
            Roster → campaña → precio → ok del cliente → contrato → firma →
            publicar → (si toca) plataforma → pagar por Zexel.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            El Excel solo trae Instagram, país y tipo. El precio y el contrato
            nacen en la campaña, cuando el cliente ya ha dicho que sí (o cuando
            alguien pulsa Activar sin ese sí).
          </p>
          <p className="text-muted-foreground">
            En paralelo sigue existiendo «Registrar influencer»: Instagram +
            cliente + piezas + precios → contrato en borrador en un solo
            formulario. Es el camino viejo, el del alta con contrato.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <Badge>Camino A</Badge>
            <h2 className="font-heading text-lg font-medium">
              Roster (el del Excel)
            </h2>
          </div>
          <ol className="grid gap-2">
            <Step
              n="1"
              title="Listas cerradas"
              href="/creators/catalogo"
              hrefLabel="Listas"
            >
              País y tipo no se escriben. Se eligen. Si el Excel dice ES o
              spain, hace falta un alias a España.
            </Step>
            <Arrow />
            <Step
              n="2"
              title="Entrar al roster"
              href="/creators"
              hrefLabel="Creators"
            >
              Alta suelta o importar Excel/CSV. Queda el Instagram, el país y el
              tipo. Sin precio, sin cliente, sin contrato.
            </Step>
            <Arrow />
            <Step
              n="3"
              title="Meterlo en una campaña"
              href="/campanas"
              hrefLabel="Campañas"
            >
              Pasa a «En roster». Si ese Instagram ya está en otra campaña, se
              avisa. Todavía no hay piezas.
            </Step>
            <Arrow />
            <Step n="4" title="Poner precios">
              Venta en USD y coste en la moneda del perfil. Al guardar, el
              estado salta solo a «Pendiente de cliente».
            </Step>
            <Arrow />
            <Step n="5" title="Validación del cliente (manual)">
              El equipo marca Validado o Descartado. No hay portal para el
              cliente: es un botón vuestro. Se puede activar también desde
              Pendiente, sin validar.
            </Step>
            <Arrow />
            <Step n="6" title="Activar">
              Pedís número de piezas. Si la campaña tiene cliente y el perfil
              no tiene contrato con ese cliente, se crea un contrato en
              borrador (plazo de pago fijo a 30 días). Si ya tenía contrato con
              ese cliente, solo marca «Activo»: no crea piezas nuevas.
            </Step>
          </ol>
        </section>

        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Camino B</Badge>
            <h2 className="font-heading text-lg font-medium">
              Alta con contrato
            </h2>
          </div>
          <ol className="grid gap-2">
            <Step
              n="1"
              title="Registrar influencer"
              href="/creators/nuevo"
              hrefLabel="Formulario"
            >
              Instagram, cliente, campaña opcional, nº de contenidos, venta,
              coste, plazo y condiciones. Al guardar: perfil + contrato
              borrador + piezas vacías.
            </Step>
            <Arrow />
            <Step n="2" title="Sigue en Contratos">
              Mismo ciclo de firma y contenidos que el camino A, pero os
              saltáis roster, precios de propuesta y el ok del cliente.
            </Step>
            <Arrow />
            <Step
              n="3"
              title="Otro cliente, otra cadena"
              href="/creators"
              hrefLabel="Ficha"
            >
              «Meter con otro cliente» abre un contrato nuevo (Higgsfield y
              Many Chat a la vez). Ampliar o renovar es siempre del mismo
              cliente.
            </Step>
          </ol>
          <Tension>
            El Panel vacío y el botón de Creators siguen empujando al camino B.
            Si el roster es la fuente de verdad, este alta es un atajo que
            deja perfiles sin país/tipo y campañas sin paso por validación.
          </Tension>
        </section>
      </div>

      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-medium">
          A partir del contrato (los dos caminos se juntan)
        </h2>
        <ol className="grid gap-2 md:grid-cols-2">
          <Step
            n="7"
            title="Enviar a firma"
            href="/contratos"
            hrefLabel="Contratos"
          >
            Enlace privado al talento o agencia. Con Resend se manda; si no, se
            copia. En campaña se pueden encolar los N del filtro.
          </Step>
          <Step n="8" title="El firmante rellena y acepta" hrefLabel="Público">
            Identidad fiscal, email de cobro (Zexel), moneda y contacto. Queda
            PDF + SHA-256 + IP. El PDF aceptado no se regenera. País del
            firmante es texto libre, no el catálogo del roster.
          </Step>
          <Step
            n="9"
            title="Publicar contenidos"
            href="/contenidos"
            hrefLabel="Contenidos"
          >
            Enlace del post + una fecha. Un URL no se puede repetir. Se puede
            marcar publicado aunque el contrato no esté firmado (pide
            confirmación).
          </Step>
          <Step
            n="10"
            title="Finanzas"
            href="/finanzas"
            hrefLabel="Finanzas"
          >
            Higgsfield: copiar URLs y marcar En plataforma. Pack (Many Chat):
            no se paga hasta cerrar todas las piezas de esa campaña con ese
            perfil. Zexel: lote, se congela importe y quién lo marcó.
          </Step>
        </ol>
      </section>

      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-medium">Estados, tal cual</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil en campaña</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              En roster → Pendiente de cliente → Validado → Activo. O
              Descartado. Los botones dejan saltar entre los cuatro primeros
              sin orden. Activo solo sale al pulsar Activar.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contrato</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Borrador → Enviado → Vigente → Completado. Si se amplía o
              renueva, el padre pasa a Renovado. Cancelado conserva historial.
              Anexo de contenidos = mismo coste; si cambia el coste,
              renovación. Condiciones particulares: se editan en borrador; si
              ya firmó, anexo de condiciones (0 piezas, firma nueva).
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pieza</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Sin agendar → Agendado → Publicado (Contents) → En plataforma
              (Finanzas, si el cliente lo pide). Pagado es un sello aparte, no
              un estado. El cliente marca cómo se liquida: por pieza o al
              cerrar el pack.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-medium">
          Quién toca cada tramo
        </h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Tramo</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Pantalla</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2">Listas, roster, import Excel</td>
                <td className="px-3 py-2">Gestión de creators</td>
                <td className="px-3 py-2">Creators / Listas / Importar</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Campaña, precios, activar</td>
                <td className="px-3 py-2">Gestión de creators</td>
                <td className="px-3 py-2">Campañas → ficha</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Mandar a firma</td>
                <td className="px-3 py-2">Gestión de creators</td>
                <td className="px-3 py-2">Contrato o campaña</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Firmar</td>
                <td className="px-3 py-2">Talento / agencia (sin cuenta)</td>
                <td className="px-3 py-2">/firmar/…</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Marcar publicado</td>
                <td className="px-3 py-2">Gestión de creators</td>
                <td className="px-3 py-2">Contenidos</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Plataforma y lote Zexel</td>
                <td className="px-3 py-2">Contabilidad / Admin</td>
                <td className="px-3 py-2">Finanzas</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Invitar al equipo</td>
                <td className="px-3 py-2">Admin</td>
                <td className="px-3 py-2">Equipo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-medium">
          Sitios donde el flujo se tuerce
        </h2>
        <ul className="grid gap-2">
          <li>
            <Tension>
              Dos altas. Roster (sin contrato) y «Registrar influencer» (con
              contrato). El vacío del Panel manda al segundo.
            </Tension>
          </li>
          <li>
            <Tension>
              «Pendiente de cliente» no es un envío al cliente: es un estado
              interno. Se puede Activar sin haber marcado Validado.
            </Tension>
          </li>
          <li>
            <Tension>
              Si el perfil ya tiene contrato con ese cliente, Activar no crea
              contenidos de esta campaña: solo pone Activo. El cruce roster ↔
              piezas queda a medias.
            </Tension>
          </li>
          <li>
            <Tension>
              Al activar desde roster el plazo de pago se fija a 30 días. En el
              alta con contrato sí se elige.
            </Tension>
          </li>
          <li>
            <Tension>
              Una campaña sin cliente no se puede activar. El roster sí admite
              perfiles antes de tener cliente.
            </Tension>
          </li>
          <li>
            <Tension>
              No hay órdenes de compra, facturas, cobro de cliente, P&amp;L ni
              multi-sociedad. Finanzas hoy es «subir a plataforma + marcar
              pagado a perfiles».
            </Tension>
          </li>
        </ul>
      </section>
    </main>
  );
}
