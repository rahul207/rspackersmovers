import { lazy } from 'react';
import { Hero } from '../features/booking/Hero';
import { DeferredSection } from '../ui/DeferredSection';

const Services = lazy(() => import('../features/content/Services'));
const HowItWorks = lazy(() => import('../features/content/HowItWorks'));
const Clients = lazy(() => import('../features/content/Clients'));
const Testimonials = lazy(() => import('../features/content/Testimonials'));
const About = lazy(() => import('../features/content/About'));
const ContactSection = lazy(() => import('../features/contact/ContactSection'));
const Faq = lazy(() => import('../features/content/Faq'));

export default function HomePage() {
  return (
    <>
      <Hero />
      <DeferredSection id="services" headingId="services-title" minHeightClass="min-h-[34rem]">
        <Services />
      </DeferredSection>
      <DeferredSection
        id="how-it-works"
        headingId="how-it-works-title"
        minHeightClass="min-h-[28rem]"
      >
        <HowItWorks />
      </DeferredSection>
      <DeferredSection id="clients" headingId="clients-title" minHeightClass="min-h-[30rem]">
        <Clients />
      </DeferredSection>
      <DeferredSection
        id="testimonials"
        headingId="testimonials-title"
        minHeightClass="min-h-[40rem]"
      >
        <Testimonials />
      </DeferredSection>
      <DeferredSection id="about" headingId="about-title" minHeightClass="min-h-[40rem]">
        <About />
      </DeferredSection>
      <DeferredSection id="contact" headingId="contact-title" minHeightClass="min-h-[56rem]">
        <ContactSection />
      </DeferredSection>
      <DeferredSection id="faq" headingId="faq-title" minHeightClass="min-h-[36rem]">
        <Faq />
      </DeferredSection>
    </>
  );
}
