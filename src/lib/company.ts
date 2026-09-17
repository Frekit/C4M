// Datos de la parte contratante que aparecen en el contrato. Viven en variables
// de entorno porque en esta fase no hay entidad Sociedad todavía.
export type Company = {
  legalName: string;
  taxId: string;
  address: string;
  email: string;
};

export function getCompany(): Company {
  return {
    legalName: process.env.COMPANY_LEGAL_NAME?.trim() || "Creators For Media, S.L.",
    taxId: process.env.COMPANY_TAX_ID?.trim() || "B00000000",
    address:
      process.env.COMPANY_ADDRESS?.trim() ||
      "Calle Ejemplo 1, 28001 Madrid, España",
    email: process.env.COMPANY_EMAIL?.trim() || "finanzas@creatorsformedia.com",
  };
}
