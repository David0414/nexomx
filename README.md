# NexoMx

Directorio privado de empresas industriales de México. Stack: Vite, React, TypeScript, Tailwind, Supabase y Vercel.

## Ver la interfaz sin configurar nada

```bash
npm install
npm run dev
```

Sin claves de Supabase arranca en modo demostración con datos ficticios. Un correo con la palabra «admin» abre el panel de administrador. Este modo no existe en el sitio publicado.

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com), en la región más cercana a México.
2. En **SQL Editor**, pega y ejecuta `supabase/migrations/0001_esquema.sql`, `0002_favoritos.sql` y `0003_panel_admin.sql`, `0004_edicion_admin.sql`, `0005_giros.sql` y `0006_cuenta_demo.sql`, en ese orden.
3. En **Authentication > Sign In / Providers**, desactiva **Allow new users to sign up**. Así solo tú creas cuentas.
4. En la misma sección, sube la longitud mínima de contraseña a 10.

### 2. Cargar los datos

Copia `.env.example` como `.env.local` y llena la URL, la clave pública (anon) y la clave de servicio.

```bash
pip install openpyxl
python scripts/importar.py --simular
python scripts/importar.py
```

Repetir la carga actualiza los datos sin duplicarlos. Lo que edites o borres desde el panel se respeta: esas empresas no se tocan. Si el total de empresas o contactos cambia, actualiza también el texto y `FORMA_ENTRADA` de la pantalla de entrada (`src/pages/Entrada.tsx`, `src/lib/mexico.ts`).

Después asigna los giros con `python scripts/clasificar.py` (usa `--simular` para revisar antes). Es por palabras clave y marcas conocidas; lo que no reconoce queda como «Sin clasificar». Las empresas editadas a mano no se tocan.

### 3. Tu cuenta de administrador

En **Authentication > Users**, crea tu usuario con correo y contraseña. Copia su ID y ejecuta en **SQL Editor**:

```sql
insert into public.perfiles (id, nombre, correo, rol)
values ('ID-DE-TU-USUARIO', 'Tu nombre', 'tu@correo.com', 'admin');
```

### 4. Función de administrador

```bash
npx supabase login
npx supabase link --project-ref TU-PROYECTO
npx supabase functions deploy admin-clientes
```

Cuando tengas dominio, limita quién puede llamarla:

```bash
npx supabase secrets set ORIGEN_PERMITIDO=https://tu-dominio.mx
```

### 5. Vercel

Importa el proyecto en Vercel. Detecta Vite solo. Agrega estas dos variables y publica:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nunca agregues la clave de servicio en Vercel ni en una variable `VITE_`.

## Logos de las empresas

Se piden al servicio público de íconos de Google usando el dominio del sitio web de cada empresa. Si no hay logo, se muestran las iniciales. En una muestra de 40 empresas reales, 24 tuvieron logo. El navegador de cada cliente consulta a Google el dominio de las empresas que ve.

## Cómo se protegen los datos

- Los clientes no leen las tablas: solo llaman funciones que validan la cuenta, entregan 25 filas por página y descuentan de su límite diario (1,000 resultados por defecto, editable por cliente).
- Favoritos tiene un tope de 200 empresas por cuenta y no incluye correos ni personas.
- Cada consulta queda registrada y se resume en **Analíticas**.
- Una cuenta vencida o suspendida deja de recibir datos de inmediato.
- `contactos.xlsx` está excluido de git y de Vercel. Nunca lo pongas en `public/`.
- El enlace de origen se guarda para evitar duplicados, pero nunca se entrega a los clientes.
