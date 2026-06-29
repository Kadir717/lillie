import type { CvReactTemplate } from "./cv-react-template";
import { classicProfessionalReactTemplate } from "./classic-professional";
import { developerCardReactTemplate } from "./developer-card";

export const reactTemplates: Record<string, CvReactTemplate> = {
  classic_professional: classicProfessionalReactTemplate,
  developer_card: developerCardReactTemplate,
};

export const defaultReactTemplate = classicProfessionalReactTemplate;

export { classicProfessionalReactTemplate, developerCardReactTemplate };
export type { CvReactTemplate } from "./cv-react-template";
