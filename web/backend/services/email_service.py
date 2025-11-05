#!/usr/bin/env python3
"""
Email Service for TradingAgents Web Interface
Handles sending analysis reports via email
"""

import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
import time
import markdown
from markdown.extensions.tables import TableExtension
from markdown.extensions.fenced_code import FencedCodeExtension
from markdown.extensions.codehilite import CodeHiliteExtension


class EmailService:
    """
    Email service for sending analysis reports
    """
    
    def __init__(self):
        """Initialize email service with SMTP configuration"""
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.smtp_from_email = os.getenv("SMTP_FROM_EMAIL")
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        self.app_base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
        self.enabled = self._validate_config()
        
        # Initialize Jinja2 environment for email templates
        template_dir = Path(__file__).parent.parent / "templates" / "email"
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )
        
        if self.enabled:
            print("✅ Email service initialized successfully")
        else:
            print("⚠️  Email service disabled: SMTP configuration incomplete")
    
    def _validate_config(self) -> bool:
        """
        Validate SMTP configuration
        
        Returns:
            bool: True if configuration is valid, False otherwise
        """
        required = [
            self.smtp_host,
            self.smtp_username,
            self.smtp_password,
            self.smtp_from_email
        ]
        
        if not all(required):
            missing = []
            if not self.smtp_host:
                missing.append("SMTP_HOST")
            if not self.smtp_username:
                missing.append("SMTP_USERNAME")
            if not self.smtp_password:
                missing.append("SMTP_PASSWORD")
            if not self.smtp_from_email:
                missing.append("SMTP_FROM_EMAIL")
            
            print(f"⚠️  Missing SMTP configuration: {', '.join(missing)}")
            return False
        
        return True
    
    def test_connection(self) -> bool:
        """
        Test SMTP connection
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        if not self.enabled:
            return False
        
        try:
            if self.smtp_use_tls:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=10)
            
            server.login(self.smtp_username, self.smtp_password)
            server.quit()
            print("✅ SMTP connection test successful")
            return True
        except Exception as e:
            print(f"❌ SMTP connection test failed: {e}")
            return False
    
    async def send_analysis_report(
        self,
        user_email: str,
        analysis_id: str,
        ticker: str,
        company_name: str,
        analysis_date: str,
        trading_decision: str,
        report_sections: Dict[str, str],
        max_retries: int = 3
    ) -> bool:
        """
        Send analysis report email with retry logic
        
        Args:
            user_email: Recipient email address
            analysis_id: Analysis ID
            ticker: Stock ticker
            company_name: Company name
            analysis_date: Analysis date
            trading_decision: Trading decision (买入/卖出/观望)
            report_sections: Dictionary containing report sections
            max_retries: Maximum number of retry attempts
        
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        print(f"📧 [EmailService] send_analysis_report called")
        print(f"   Enabled: {self.enabled}")
        print(f"   To: {user_email}")
        print(f"   Analysis: {analysis_id}")
        
        if not self.enabled:
            print("⚠️  [EmailService] Email service disabled, skipping email send")
            return False
        
        # Construct analysis URL
        analysis_url = f"{self.app_base_url}/analysis/{analysis_id}"
        print(f"📧 [EmailService] Analysis URL: {analysis_url}")
        
        # Compose email content
        print(f"📧 [EmailService] Composing email content...")
        try:
            html_body = self._compose_email_html(
                ticker=ticker,
                company_name=company_name,
                analysis_date=analysis_date,
                trading_decision=trading_decision,
                report_sections=report_sections,
                analysis_url=analysis_url
            )
            print(f"   HTML body: {len(html_body)} chars")
            
            text_body = self._compose_email_text(
                ticker=ticker,
                company_name=company_name,
                analysis_date=analysis_date,
                trading_decision=trading_decision,
                report_sections=report_sections,
                analysis_url=analysis_url
            )
            print(f"   Text body: {len(text_body)} chars")
        except Exception as e:
            print(f"❌ [EmailService] Failed to compose email: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        # Email subject
        subject = f"分析报告 - {ticker} ({company_name}) - {trading_decision}"
        print(f"📧 [EmailService] Subject: {subject}")
        
        # Retry logic with exponential backoff
        for attempt in range(max_retries):
            try:
                print(f"📧 [EmailService] Attempt {attempt + 1}/{max_retries} - Sending email...")
                
                # Send email in thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    self._send_email_sync,
                    user_email,
                    subject,
                    html_body,
                    text_body
                )
                
                print(f"✅ [EmailService] Email sent successfully to {user_email} for analysis {analysis_id}")
                return True
                
            except Exception as e:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                print(f"❌ [EmailService] Email send attempt {attempt + 1}/{max_retries} failed: {e}")
                import traceback
                traceback.print_exc()
                
                if attempt < max_retries - 1:
                    print(f"⏳ [EmailService] Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"❌ [EmailService] Failed to send email after {max_retries} attempts")
                    return False
        
        return False
    
    def _send_email_sync(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str
    ):
        """
        Send email synchronously (called from executor)
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body
        """
        print(f"📧 [SMTP] Creating email message...")
        print(f"   From: {self.smtp_from_email}")
        print(f"   To: {to_email}")
        print(f"   Subject: {subject}")
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        # Set sender with display name
        msg['From'] = f"TradingAgents <{self.smtp_from_email}>"
        msg['To'] = to_email
        
        # Attach text and HTML parts
        part1 = MIMEText(text_body, 'plain', 'utf-8')
        part2 = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(part1)
        msg.attach(part2)
        print(f"📧 [SMTP] Message created with HTML and text parts")
        
        # Send email
        print(f"📧 [SMTP] Connecting to SMTP server...")
        print(f"   Host: {self.smtp_host}:{self.smtp_port}")
        print(f"   TLS: {self.smtp_use_tls}")
        
        try:
            if self.smtp_use_tls:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30)
                print(f"📧 [SMTP] Connected, starting TLS...")
                server.starttls()
                print(f"📧 [SMTP] TLS started")
            else:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=30)
                print(f"📧 [SMTP] Connected with SSL")
            
            print(f"📧 [SMTP] Logging in...")
            server.login(self.smtp_username, self.smtp_password)
            print(f"📧 [SMTP] Login successful")
            
            print(f"📧 [SMTP] Sending email...")
            server.sendmail(self.smtp_from_email, to_email, msg.as_string())
            print(f"📧 [SMTP] Email sent successfully")
            
            server.quit()
            print(f"📧 [SMTP] Connection closed")
            
        except Exception as e:
            print(f"❌ [SMTP] Error during email send: {e}")
            raise
    
    def _markdown_to_html(self, markdown_text: str) -> str:
        """
        Convert Markdown to HTML with inline styles
        
        Args:
            markdown_text: Markdown formatted text
            
        Returns:
            str: HTML with inline styles
        """
        if not markdown_text:
            return ""
        
        # Convert markdown to HTML
        md = markdown.Markdown(extensions=[
            'tables',
            'fenced_code',
            'nl2br',
            'sane_lists'
        ])
        html = md.convert(markdown_text)
        
        # Add inline styles for email compatibility
        html = html.replace('<h1>', '<h1 style="color: #212529; font-size: 24px; font-weight: 600; margin: 20px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #667eea;">')
        html = html.replace('<h2>', '<h2 style="color: #212529; font-size: 20px; font-weight: 600; margin: 18px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e9ecef;">')
        html = html.replace('<h3>', '<h3 style="color: #495057; font-size: 18px; font-weight: 600; margin: 16px 0 10px 0;">')
        html = html.replace('<h4>', '<h4 style="color: #495057; font-size: 16px; font-weight: 600; margin: 14px 0 8px 0;">')
        html = html.replace('<p>', '<p style="color: #495057; font-size: 14px; line-height: 1.8; margin: 10px 0;">')
        html = html.replace('<ul>', '<ul style="color: #495057; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 25px;">')
        html = html.replace('<ol>', '<ol style="color: #495057; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 25px;">')
        html = html.replace('<li>', '<li style="margin: 5px 0;">')
        html = html.replace('<strong>', '<strong style="font-weight: 600; color: #212529;">')
        html = html.replace('<em>', '<em style="font-style: italic; color: #495057;">')
        html = html.replace('<code>', '<code style="background-color: #f8f9fa; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px; color: #e83e8c;">')
        html = html.replace('<pre>', '<pre style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; margin: 15px 0;">')
        html = html.replace('<blockquote>', '<blockquote style="border-left: 4px solid #667eea; padding-left: 15px; margin: 15px 0; color: #6c757d; font-style: italic;">')
        html = html.replace('<table>', '<table style="border-collapse: collapse; width: 100%; margin: 15px 0; font-size: 14px;">')
        html = html.replace('<th>', '<th style="background-color: #f8f9fa; padding: 10px; border: 1px solid #dee2e6; text-align: left; font-weight: 600;">')
        html = html.replace('<td>', '<td style="padding: 10px; border: 1px solid #dee2e6;">')
        html = html.replace('<hr>', '<hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">')
        
        return html
    
    def _compose_email_html(
        self,
        ticker: str,
        company_name: str,
        analysis_date: str,
        trading_decision: str,
        report_sections: Dict[str, str],
        analysis_url: str
    ) -> str:
        """
        Compose HTML email content using Jinja2 template
        
        Args:
            ticker: Stock ticker
            company_name: Company name
            analysis_date: Analysis date
            trading_decision: Trading decision
            report_sections: Dictionary containing report sections (Markdown format)
            analysis_url: URL to view analysis in web app
        
        Returns:
            str: HTML email content
        """
        try:
            # Convert all Markdown sections to HTML with inline styles
            market_analysis_html = self._markdown_to_html(report_sections.get('market_analysis', ''))
            fundamentals_analysis_html = self._markdown_to_html(report_sections.get('fundamentals_analysis', ''))
            sentiment_analysis_html = self._markdown_to_html(report_sections.get('sentiment_analysis', ''))
            news_analysis_html = self._markdown_to_html(report_sections.get('news_analysis', ''))
            risk_assessment_html = self._markdown_to_html(report_sections.get('risk_assessment', ''))
            
            template = self.jinja_env.get_template('analysis_report.html')
            return template.render(
                ticker=ticker,
                company_name=company_name,
                analysis_date=analysis_date,
                trading_decision=trading_decision,
                market_analysis=market_analysis_html,
                fundamentals_analysis=fundamentals_analysis_html,
                sentiment_analysis=sentiment_analysis_html,
                news_analysis=news_analysis_html,
                risk_assessment=risk_assessment_html,
                analysis_url=analysis_url,
                app_base_url=self.app_base_url
            )
        except Exception as e:
            print(f"❌ Failed to render HTML template: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to simple HTML
            return self._compose_fallback_html(
                ticker, company_name, analysis_date, trading_decision, report_sections, analysis_url
            )
    
    def _compose_email_text(
        self,
        ticker: str,
        company_name: str,
        analysis_date: str,
        trading_decision: str,
        report_sections: Dict[str, str],
        analysis_url: str
    ) -> str:
        """
        Compose plain text email content
        
        Args:
            ticker: Stock ticker
            company_name: Company name
            analysis_date: Analysis date
            trading_decision: Trading decision
            report_sections: Dictionary containing report sections
            analysis_url: URL to view analysis in web app
        
        Returns:
            str: Plain text email content
        """
        try:
            template = self.jinja_env.get_template('analysis_report.txt')
            return template.render(
                ticker=ticker,
                company_name=company_name,
                analysis_date=analysis_date,
                trading_decision=trading_decision,
                market_analysis=report_sections.get('market_analysis', ''),
                fundamentals_analysis=report_sections.get('fundamentals_analysis', ''),
                sentiment_analysis=report_sections.get('sentiment_analysis', ''),
                news_analysis=report_sections.get('news_analysis', ''),
                risk_assessment=report_sections.get('risk_assessment', ''),
                analysis_url=analysis_url
            )
        except Exception as e:
            print(f"❌ Failed to render text template: {e}")
            # Fallback to simple text
            return self._compose_fallback_text(
                ticker, company_name, analysis_date, trading_decision, report_sections, analysis_url
            )
    
    def _compose_fallback_html(
        self,
        ticker: str,
        company_name: str,
        analysis_date: str,
        trading_decision: str,
        report_sections: Dict[str, str],
        analysis_url: str
    ) -> str:
        """Fallback HTML email when template fails"""
        sections_html = ""
        
        section_titles = {
            'market_analysis': '📈 市场环境分析',
            'fundamentals_analysis': '💼 基本面评估',
            'sentiment_analysis': '💬 情绪与舆论',
            'news_analysis': '📰 新闻分析',
            'risk_assessment': '⚠️ 风险评估'
        }
        
        for section_name, section_content in report_sections.items():
            if section_content:
                title = section_titles.get(section_name, section_name.replace('_', ' ').title())
                # Convert markdown to HTML
                content_html = self._markdown_to_html(section_content)
                sections_html += f'<div style="margin: 20px 0;"><h2 style="color: #212529; font-size: 20px; font-weight: 600; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #667eea;">{title}</h2><div>{content_html}</div></div>'
        
        return f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📊 TradingAgents 分析报告</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">AI 驱动的多智能体股票分析系统</p>
                </div>
                <div style="background-color: #f8f9fa; padding: 25px 30px; border-bottom: 1px solid #e9ecef;">
                    <div style="margin-bottom: 12px;"><span style="font-weight: 600; color: #495057;">股票代码:</span> <span style="color: #212529;">{ticker}</span></div>
                    <div style="margin-bottom: 12px;"><span style="font-weight: 600; color: #495057;">公司名称:</span> <span style="color: #212529;">{company_name}</span></div>
                    <div style="margin-bottom: 12px;"><span style="font-weight: 600; color: #495057;">分析日期:</span> <span style="color: #212529;">{analysis_date}</span></div>
                    <div><span style="font-weight: 600; color: #495057;">交易决策:</span> <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; background-color: #d4edda; color: #155724;">{trading_decision}</span></div>
                </div>
                <div style="padding: 30px;">
                    {sections_html}
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; font-size: 13px; color: #856404;">
                        <strong>⚠️ 风险提示:</strong> 投资有风险，入市需谨慎。本报告仅供参考，不构成投资建议。请根据自身风险承受能力谨慎决策。
                    </div>
                </div>
                <div style="text-align: center; padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
                    <p style="margin-bottom: 15px; color: #495057;">查看完整的交互式分析报告</p>
                    <a href="{analysis_url}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">查看网页版报告</a>
                </div>
            </div>
        </body>
        </html>
        """
    
    def _compose_fallback_text(
        self,
        ticker: str,
        company_name: str,
        analysis_date: str,
        trading_decision: str,
        report_sections: Dict[str, str],
        analysis_url: str
    ) -> str:
        """Fallback text email when template fails"""
        sections_text = ""
        for section_name, section_content in report_sections.items():
            if section_content:
                title = section_name.replace('_', ' ').title()
                sections_text += f"\n\n{title}:\n{section_content[:500]}..."
        
        return f"""
TradingAgents 分析报告

股票代码: {ticker}
公司名称: {company_name}
分析日期: {analysis_date}
交易决策: {trading_decision}

{sections_text}

查看完整报告: {analysis_url}
        """


# Global email service instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """
    Get global email service instance (singleton)
    
    Returns:
        EmailService: Email service instance
    """
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


def init_email_service() -> EmailService:
    """
    Initialize email service (called on app startup)
    
    Returns:
        EmailService: Email service instance
    """
    global _email_service
    _email_service = EmailService()
    return _email_service
